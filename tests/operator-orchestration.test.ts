import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runToolRound } from "../lib/ai/providers/tool-round.ts";
import { executeTool, toolResultForModel } from "../lib/ai/tools/executor.ts";
import { unavailable } from "../lib/ai/tools/types.ts";
import { getTool, getToolDeclarations, listTools } from "../lib/ai/tools/registry.ts";
import { applyApproval } from "../lib/ai/approval.ts";
import type { AgentToolCall, AgentToolOutcome } from "../lib/ai/providers/types.ts";
import type { Client } from "../lib/ai/tools/types.ts";

/**
 * Cross-module orchestration, driven through the REAL registry, executor and
 * scheduler with a scripted model.
 *
 * What these can and cannot establish, stated plainly because the difference
 * matters: they prove the operator SCHEDULES and GATES correctly for each
 * scenario — reads fan out, writes stay ordered, a dependent write cannot
 * overtake its read, an unavailable integration does not sink the rest of the
 * turn. They do NOT prove the model picks the right tools for a prompt; only
 * scripts/gemini-probe.ts and operator:live can, because that needs a model.
 */

const noDb = new Proxy({}, {
  get() { throw new Error("simulated database failure"); },
}) as Client;

/** Runs a round through the real executor, exactly as the agent loop does. */
function makeExecutor(log: string[]) {
  return async (call: AgentToolCall): Promise<AgentToolOutcome> => {
    log.push(call.name);
    const result = await executeTool(call.name, call.args, { supabase: noDb });
    if (result.status === "confirmation_required") {
      return {
        response: toolResultForModel(result), label: call.name, ok: false,
        halt: { reason: "confirmation_required", toolName: result.toolName, summary: result.summary, args: result.args },
      };
    }
    return { response: toolResultForModel(result), label: call.name, ok: result.status === "ok" };
  };
}

const parallelSafe = (name: string) => getTool(name)?.risk === "safe";

describe("scenario 1 — 'What should I do tomorrow?'", () => {
  const CALLS = ["get_upcoming_tasks", "get_routines", "get_goals", "get_upcoming"];

  test("every tool the scenario needs exists and is a safe read", () => {
    for (const name of CALLS) {
      const tool = getTool(name);
      assert.ok(tool, `${name} is missing from the registry`);
      assert.equal(tool!.risk, "safe", `${name} should be a read`);
    }
  });

  test("the four reads fan out concurrently rather than queueing", async () => {
    // Four sequential round trips where one would do is the difference
    // between a usable answer and a slow one.
    let live = 0, peak = 0;
    const execute = async (): Promise<AgentToolOutcome> => {
      live++; peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
      return { response: {}, label: "", ok: true };
    };
    await runToolRound(CALLS.map((name) => ({ name, args: {} })), execute, parallelSafe);
    assert.equal(peak, CALLS.length, "independent reads must run concurrently");
  });
});

describe("scenario 2 — reads across modules, then a write", () => {
  test("a read/write mixture runs strictly in order", async () => {
    // "Make me a plan, then create the task" must not create the task while
    // the reads it depends on are still in flight.
    const order: string[] = [];
    const execute = async (call: AgentToolCall): Promise<AgentToolOutcome> => {
      // The reads are deliberately slower than the write; concurrency would
      // therefore show up as the write finishing first.
      await new Promise((r) => setTimeout(r, call.name.startsWith("get_") ? 10 : 1));
      order.push(call.name);
      return { response: {}, label: "", ok: true };
    };
    await runToolRound(
      [
        { name: "get_goals", args: {} },
        { name: "get_upcoming_tasks", args: {} },
        { name: "create_task", args: { title: "Start the assignment" } },
      ],
      execute,
      parallelSafe,
    );
    assert.deepEqual(order, ["get_goals", "get_upcoming_tasks", "create_task"]);
  });
});

describe("scenario 5 — 'find my hottest leads and create follow-up tasks'", () => {
  test("the read runs before the write, in the order the model asked", async () => {
    const order: string[] = [];
    const execute = async (call: AgentToolCall): Promise<AgentToolOutcome> => {
      await new Promise((r) => setTimeout(r, call.name.startsWith("get_") ? 10 : 1));
      order.push(call.name);
      return { response: {}, label: "", ok: true };
    };
    await runToolRound(
      [{ name: "get_leads", args: {} }, { name: "create_follow_up", args: {} }, { name: "create_task", args: {} }],
      execute,
      parallelSafe,
    );
    assert.deepEqual(order, ["get_leads", "create_follow_up", "create_task"]);
  });

  test("two writes never overlap", async () => {
    let live = 0, peak = 0;
    const execute = async (): Promise<AgentToolOutcome> => {
      live++; peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
      return { response: {}, label: "", ok: true };
    };
    await runToolRound(
      [{ name: "create_task", args: {} }, { name: "update_task", args: {} }],
      execute,
      parallelSafe,
    );
    assert.equal(peak, 1, "writes must not run concurrently");
  });
});

describe("an unavailable integration does not sink the turn", () => {
  /**
   * Tested against the executor's translation layer rather than through a
   * tool, because no tool in the registry currently returns this status —
   * Brightspace was the only gated integration and it is gone. The path it
   * used still exists and still matters: the next gated integration
   * inherits it, and the failure it prevents (an assistant narrating "you
   * have no assignments" for a service it never reached) is the worst kind
   * this codebase has.
   */
  test("the model is told it could not look, not that there was nothing", () => {
    const flat = toolResultForModel(
      unavailable("hevy", "configuration_required", "Hevy is not connected."),
    );
    assert.equal(flat.ok, false);
    assert.equal(flat.error, "integration_unavailable");
    assert.equal(flat.integration, "hevy");
    assert.equal(flat.state, "configuration_required");
    // Conflating this with an empty result is how an assistant ends up
    // narrating "you logged no workouts" for a service it never reached.
    assert.notDeepEqual(flat.data, []);
    assert.equal(flat.data, undefined);
  });

  test("the rest of the round still runs after a tool reports unavailable", async () => {
    const log: string[] = [];
    const execute = async (call: AgentToolCall): Promise<AgentToolOutcome> => {
      log.push(call.name);
      if (call.name === "get_workout_history") {
        return { response: toolResultForModel(unavailable("hevy", "configuration_required", "no")), label: "", ok: false };
      }
      return { response: {}, label: "", ok: true };
    };
    const outcomes = await runToolRound(
      [
        { name: "get_workout_history", args: {} },
        { name: "get_upcoming_tasks", args: {} },
        { name: "get_goals", args: {} },
      ],
      execute,
      parallelSafe,
    );
    assert.equal(outcomes.length, 3, "an unavailable integration must not halt the round");
    assert.deepEqual(log.sort(), ["get_goals", "get_upcoming_tasks", "get_workout_history"]);
  });
});

describe("failure recovery inside a turn", () => {
  test("a failing tool yields a structured result and the round continues", async () => {
    const log: string[] = [];
    const outcomes = await runToolRound(
      [{ name: "get_upcoming_tasks", args: {} }, { name: "get_goals", args: {} }],
      makeExecutor(log),
      parallelSafe,
    );
    assert.equal(outcomes.length, 2);
    for (const o of outcomes) {
      assert.equal(o.ok, false);
      assert.equal((o.response as { error?: string }).error, "error");
      // No stack trace, no Postgres text, nothing internal.
      assert.doesNotMatch(JSON.stringify(o.response), /simulated database failure|Proxy|\.ts:\d+/);
    }
  });
});

describe("one operator, one registry", () => {
  test("only two surfaces enter the operator, and both use the same declarations", () => {
    // Voice and web chat are interfaces; the tool set cannot differ between
    // them, or "JARVIS" would mean two different assistants.
    const declarations = getToolDeclarations();
    assert.equal(declarations.length, listTools().length);
  });

  test("a lower-risk surface can be given fewer tools without a second registry", () => {
    // The SMS webhook has no way to render a confirmation prompt, so it must
    // be able to take safe-only — from the same registry.
    const safeOnly = getToolDeclarations("safe");
    assert.ok(safeOnly.length < getToolDeclarations().length);
    const names = new Set(safeOnly.map((d) => d.name));
    for (const tool of listTools()) {
      if (tool.risk !== "safe") assert.equal(names.has(tool.name), false, `${tool.name} must not reach a safe-only surface`);
    }
  });

  test("an approval authorises exactly one write, with the arguments shown", () => {
    const approval = { toolName: "delete_task", args: { task_id: "the-one-shown" } };
    const first = applyApproval(approval, { name: "delete_task", args: { task_id: "something-else" } });
    assert.equal(first.confirmed, true);
    assert.deepEqual(first.args, { task_id: "the-one-shown" });
    assert.equal(applyApproval(first.remaining, { name: "delete_task", args: {} }).confirmed, false);
  });
});
