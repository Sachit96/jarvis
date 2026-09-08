import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { executeTool, toolResultForModel } from "../lib/ai/tools/executor.ts";
import { runToolRound } from "../lib/ai/providers/tool-round.ts";
import { listTools, getTool } from "../lib/ai/tools/registry.ts";
import type { AgentToolCall, AgentToolOutcome } from "../lib/ai/providers/types.ts";
import type { Client, ToolResult } from "../lib/ai/tools/types.ts";

/**
 * Step 14 — every failure becomes a controlled error.
 *
 * The requirement is not "these do not crash": it is that each distinct
 * failure stays DISTINGUISHABLE by the time it reaches the model. An
 * assistant that cannot tell "you have no assignments" from "I could not
 * reach Brightspace" is exactly the one that invents assignments, so the
 * tests below check the shape of each failure, not merely that one occurred.
 */

const noDb = new Proxy({}, {
  get() { throw new Error("simulated Supabase failure"); },
}) as Client;

const A_SAFE_TOOL = "get_tasks";

describe("malformed model output", () => {
  test("a tool name the model invented reaches no code", async () => {
    const result = await executeTool("drop_all_tables", {}, { supabase: noDb });
    assert.equal(result.status, "error");
    assert.match(result.status === "error" ? result.message : "", /not available/);
  });

  test("a prototype key cannot resolve to a tool", async () => {
    // The registry is a Map, so this is a property of the data structure
    // rather than of a filter someone has to remember. Locking it in.
    for (const name of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      assert.equal(getTool(name), undefined, `${name} must not resolve`);
      const result = await executeTool(name, {}, { supabase: noDb });
      assert.equal(result.status, "error");
    }
  });

  test("arguments that are not an object are rejected, not coerced", async () => {
    for (const args of ["a string", 42, true, ["an", "array"], null]) {
      const result = await executeTool("delete_task", args, { supabase: noDb });
      assert.notEqual(result.status, "ok", `${JSON.stringify(args)} must not execute`);
      // null becomes {} and then fails on the missing required field; the
      // others fail on type. Either way the handler is never reached.
      assert.ok(
        result.status === "invalid_arguments" || result.status === "error",
        `${JSON.stringify(args)} produced ${result.status}`,
      );
    }
  });

  test("unknown extra fields never reach a query", async () => {
    const result = await executeTool(
      "delete_task",
      { task_id: "abc", "; drop table tasks": true, limit: 99999 },
      { supabase: noDb },
    );
    // Zod object parsing strips unknown keys, so what the handler would see
    // is only the declared shape — the gate stops it here regardless.
    assert.equal(result.status, "confirmation_required");
    if (result.status !== "confirmation_required") return;
    assert.deepEqual(Object.keys(result.args), ["task_id"]);
  });
});

describe("infrastructure failure", () => {
  test("a Supabase failure becomes a structured error with no internals in it", async () => {
    const result = await executeTool(A_SAFE_TOOL, {}, { supabase: noDb });
    assert.equal(result.status, "error");
    const message = result.status === "error" ? result.message : "";
    // The thrown text must not survive into anything the model could repeat
    // back to the user.
    assert.doesNotMatch(message, /simulated Supabase failure/);
    assert.doesNotMatch(message, /Proxy|at Object|\.ts:\d+/);
    assert.match(message, /was not changed|failed/);
  });

  test("no failure path throws to the caller", async () => {
    // Every tool, driven with arguments guaranteed to be wrong, against a
    // client that throws on touch. A rejected promise anywhere here would be
    // an uncaught error inside a model turn.
    for (const tool of listTools()) {
      const result = await executeTool(tool.name, { unexpected: true }, { supabase: noDb });
      assert.ok(
        ["ok", "error", "invalid_arguments", "integration_unavailable", "confirmation_required"]
          .includes(result.status),
        `${tool.name} returned ${result.status}`,
      );
    }
  });

  test("one failing call does not take down its whole round", async () => {
    const execute = async (call: AgentToolCall): Promise<AgentToolOutcome> => {
      const result = await executeTool(call.name, call.args, { supabase: noDb });
      return { response: toolResultForModel(result), label: call.name, ok: result.status === "ok" };
    };
    const outcomes = await runToolRound(
      [{ name: A_SAFE_TOOL, args: {} }, { name: "get_goals", args: {} }],
      execute,
      () => true,
    );
    assert.equal(outcomes.length, 2);
    for (const o of outcomes) assert.equal(o.ok, false);
  });
});

describe("what the model is told", () => {
  test("every failure keeps a distinct machine-readable error", () => {
    const cases: ToolResult[] = [
      { status: "error", message: "boom" },
      { status: "invalid_arguments", issues: ["task_id: Required"] },
      {
        status: "integration_unavailable",
        integration: "brightspace",
        state: "configuration_required",
        message: "Brightspace is not connected.",
      },
      { status: "confirmation_required", toolName: "delete_task", summary: "Delete X", args: {} },
    ];
    const errors = cases.map((c) => toolResultForModel(c).error);
    assert.deepEqual(errors, [
      "error",
      "invalid_arguments",
      "integration_unavailable",
      "confirmation_required",
    ]);
    // Distinctness is the whole point — a shared "error" for all four is how
    // an unavailable integration gets narrated as an empty result.
    assert.equal(new Set(errors).size, 4);
  });

  test("an empty result stays ok, and is not mistakable for a failure", () => {
    const flat = toolResultForModel({ status: "ok", data: { tasks: [] } });
    assert.equal(flat.ok, true);
    assert.deepEqual(flat.data, { tasks: [] });
  });
});
