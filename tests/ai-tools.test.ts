import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { toGeminiDeclaration } from "../lib/ai/tools/gemini-schema.ts";
import { getToolDeclarations, listTools, toolNamesByRisk } from "../lib/ai/tools/registry.ts";
import { executeTool, toolResultForModel } from "../lib/ai/tools/executor.ts";
import { runToolRound } from "../lib/ai/providers/tool-round.ts";
import type { Client, ToolContext } from "../lib/ai/tools/types.ts";

/**
 * The executor's guarantees are what these cover, because they are the ones
 * that matter if the model misbehaves: an unknown name reaches no code,
 * malformed arguments never reach a query, and a high-risk tool cannot run
 * without approval.
 *
 * All four of those short-circuit BEFORE the handler runs, which is what
 * makes them testable with no database — the gate is reached, and rejects,
 * without a Supabase client ever being used. Where a test does need a
 * context it passes a stub that would throw if touched, so a regression that
 * let a call slip past a gate would fail loudly rather than silently pass.
 */

/** Deliberately not a usable client: any handler that reaches it will throw. */
const noDb = new Proxy(
  {},
  {
    get() {
      throw new Error("handler reached the database, but this test expected a gate to stop it first");
    },
  },
) as Client;

const ctx: ToolContext = { supabase: noDb };

describe("gemini-schema conversion", () => {
  test("maps primitives, enums, arrays and descriptions", () => {
    const decl = toGeminiDeclaration(
      "sample",
      "A sample tool",
      z.object({
        title: z.string().describe("The title"),
        count: z.number(),
        flag: z.boolean(),
        kind: z.enum(["a", "b"]),
        tags: z.array(z.string()),
      }),
    );

    assert.equal(decl.name, "sample");
    assert.equal(decl.parameters.type, "OBJECT");
    const props = decl.parameters.properties!;
    assert.equal(props.title.type, "STRING");
    assert.equal(props.title.description, "The title");
    assert.equal(props.count.type, "NUMBER");
    assert.equal(props.flag.type, "BOOLEAN");
    assert.deepEqual(props.kind.enum, ["a", "b"]);
    assert.equal(props.tags.type, "ARRAY");
    assert.equal((props.tags.items as { type: string }).type, "STRING");
  });

  test("optional and defaulted fields are unwrapped and left out of required", () => {
    const decl = toGeminiDeclaration(
      "sample",
      "d",
      z.object({
        needed: z.string(),
        maybe: z.string().optional(),
        defaulted: z.boolean().default(false),
      }),
    );

    assert.deepEqual(decl.parameters.required, ["needed"]);
    // Unwrapped to the inner type, not reported as "optional".
    assert.equal(decl.parameters.properties!.maybe.type, "STRING");
    assert.equal(decl.parameters.properties!.defaulted.type, "BOOLEAN");
  });

  test("throws on an unsupported schema rather than emitting a lenient fallback", () => {
    // A silently-wrong declaration would surface as inexplicably bad tool
    // calls at runtime; failing here means it fails at module load instead.
    assert.throws(
      () => toGeminiDeclaration("bad", "d", z.object({ when: z.date() })),
      /Unsupported Zod type/,
    );
  });

  test("rejects a non-object parameter schema", () => {
    assert.throws(() => toGeminiDeclaration("bad", "d", z.string()), /must take an object/);
  });
});

describe("registry", () => {
  test("exposes tools and builds a declaration for every one", () => {
    const tools = listTools();
    assert.ok(tools.length > 0);
    const declarations = getToolDeclarations();
    assert.equal(declarations.length, tools.length);
    for (const d of declarations) {
      assert.equal(typeof d.name, "string");
      assert.ok(d.description.length > 0, `${d.name} needs a description`);
      assert.equal(d.parameters.type, "OBJECT");
    }
  });

  test("tool names are unique", () => {
    const names = listTools().map((t) => t.name);
    assert.equal(new Set(names).size, names.length);
  });

  test("every high-risk tool can describe itself for the confirmation prompt", () => {
    // Without this the user gets asked to approve an opaque call.
    for (const tool of listTools().filter((t) => t.risk === "high")) {
      assert.equal(typeof tool.summarize, "function", `${tool.name} needs summarize()`);
    }
  });

  test("maxRisk filters the declarations handed to a surface", () => {
    const safeOnly = getToolDeclarations("safe").map((d) => d.name);
    const names = toolNamesByRisk();
    assert.deepEqual(safeOnly.sort(), [...names.safe].sort());
    assert.ok(names.high.length > 0, "expected at least one high-risk tool to gate");
    for (const risky of [...names.low, ...names.high]) {
      assert.ok(!safeOnly.includes(risky), `${risky} leaked into the safe-only set`);
    }
  });

  test("read tools are classified safe, and writes are not", () => {
    for (const tool of listTools()) {
      if (tool.name.startsWith("get_")) assert.equal(tool.risk, "safe", `${tool.name} should be safe`);
      else assert.notEqual(tool.risk, "safe", `${tool.name} writes and must not be safe`);
    }
  });
});

describe("executor", () => {
  test("rejects a name that is not in the registry", async () => {
    const result = await executeTool("drop_all_tables", {}, ctx);
    assert.equal(result.status, "error");
    assert.match((result as { message: string }).message, /Unknown tool/);
  });

  test("rejects arguments that fail the tool's schema", async () => {
    // create_task requires a title; the handler must never see this call.
    const result = await executeTool("create_task", { priority: "high" }, ctx);
    assert.equal(result.status, "invalid_arguments");
    assert.ok((result as { issues: string[] }).issues.some((i) => i.includes("title")));
  });

  test("rejects a wrongly-typed argument", async () => {
    const result = await executeTool("get_upcoming", { limit: "lots" }, ctx);
    assert.equal(result.status, "invalid_arguments");
  });

  test("rejects a value outside the schema's enum", async () => {
    const result = await executeTool("get_memory", { type: "secrets" }, ctx);
    assert.equal(result.status, "invalid_arguments");
  });

  test("a high-risk tool stops for confirmation instead of running", async () => {
    const result = await executeTool("delete_task", { task_id: "abc" }, ctx);
    assert.equal(result.status, "confirmation_required");
    const pending = result as { toolName: string; summary: string; args: Record<string, unknown> };
    assert.equal(pending.toolName, "delete_task");
    assert.match(pending.summary, /delete/i);
    // The args come back so the UI can show what would happen, and so the
    // approved call replays exactly what the user saw.
    assert.equal(pending.args.task_id, "abc");
  });

  test("confirmation is gated on the caller's flag, which the model cannot set", async () => {
    // The same call marked confirmed gets past the gate and into the handler.
    // The handler then hits the stub client and the executor converts that
    // throw into a structured error — so "error" here is precisely the proof
    // that execution was attempted, where "confirmation_required" would mean
    // the gate had blocked it again.
    const result = await executeTool(
      "delete_task",
      { task_id: "abc" },
      { supabase: noDb, confirmed: true },
    );
    assert.equal(result.status, "error");
    assert.match((result as { message: string }).message, /delete_task/);
  });

  test("validation runs before the risk gate, so a bad high-risk call is rejected as invalid", async () => {
    const result = await executeTool("delete_task", {}, ctx);
    assert.equal(result.status, "invalid_arguments");
  });

  test("an unconfigured integration reports its state instead of inventing data", async () => {
    const result = await executeTool("get_brightspace_courses", {}, ctx);
    assert.equal(result.status, "integration_unavailable");
    const unavailable = result as { integration: string; state: string };
    assert.equal(unavailable.integration, "brightspace");
    assert.equal(unavailable.state, "configuration_required");
  });

  test("a handler that throws becomes a structured error, not a stack trace", async () => {
    // get_goals is safe and reaches the handler, where the stub client throws.
    const result = await executeTool("get_goals", {}, ctx);
    assert.equal(result.status, "error");
    const message = (result as { message: string }).message;
    assert.match(message, /get_goals/);
    // The raw throw must not be forwarded — it can carry schema detail.
    assert.doesNotMatch(message, /handler reached the database/);
  });
});

describe("toolResultForModel", () => {
  test("distinguishes no-data from could-not-look", () => {
    const empty = toolResultForModel({ status: "ok", data: [] });
    assert.equal(empty.ok, true);
    assert.deepEqual(empty.data, []);

    const blocked = toolResultForModel({
      status: "integration_unavailable",
      integration: "hevy",
      state: "configuration_required",
      message: "not connected",
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error, "integration_unavailable");
    assert.equal(blocked.state, "configuration_required");
  });

  test("tells the model not to retry a call awaiting confirmation", () => {
    const payload = toolResultForModel({
      status: "confirmation_required",
      toolName: "delete_task",
      summary: "Permanently delete task abc",
      args: { task_id: "abc" },
    });
    assert.equal(payload.ok, false);
    assert.match(String(payload.message), /Do not retry/);
  });

  test("surfaces validation issues so the model can correct itself", () => {
    const payload = toolResultForModel({
      status: "invalid_arguments",
      issues: ["title: Required"],
    });
    assert.equal(payload.error, "invalid_arguments");
    assert.deepEqual(payload.issues, ["title: Required"]);
  });
});

describe("tool round scheduling", () => {
  /** Records overlap so a claim of concurrency is measured, not assumed. */
  function tracker() {
    let active = 0;
    let maxActive = 0;
    const order: string[] = [];
    return {
      order,
      maxActive: () => maxActive,
      async execute(call: { name: string; args: Record<string, unknown> }) {
        active++;
        maxActive = Math.max(maxActive, active);
        order.push(call.name);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return { response: { ok: true }, label: `ran ${call.name}`, ok: true };
      },
    };
  }

  const call = (name: string) => ({ name, args: {} });

  test("independent reads run concurrently", async () => {
    const t = tracker();
    const outcomes = await runToolRound(
      [call("get_tasks"), call("get_goals"), call("get_accounts")],
      t.execute,
      () => true,
    );
    assert.equal(outcomes.length, 3);
    assert.equal(t.maxActive(), 3, "all three should have been in flight together");
  });

  test("writes run one at a time, in the order the model asked", async () => {
    const t = tracker();
    await runToolRound([call("create_task"), call("complete_task")], t.execute, () => false);
    assert.equal(t.maxActive(), 1, "writes must not overlap");
    assert.deepEqual(t.order, ["create_task", "complete_task"]);
  });

  test("a mixed round falls back to sequential", async () => {
    // One unsafe call makes the whole round unsafe: the write may depend on
    // the read, and ordering is the only safe assumption.
    const t = tracker();
    await runToolRound(
      [call("get_tasks"), call("create_task")],
      t.execute,
      (name) => name.startsWith("get_"),
    );
    assert.equal(t.maxActive(), 1);
  });

  test("defaults to sequential when no predicate is supplied", async () => {
    const t = tracker();
    await runToolRound([call("a"), call("b")], t.execute);
    assert.equal(t.maxActive(), 1);
  });

  test("a halt stops the rest of the round from running", async () => {
    const ran: string[] = [];
    const outcomes = await runToolRound(
      [call("delete_task"), call("create_task")],
      async (c) => {
        ran.push(c.name);
        return c.name === "delete_task"
          ? {
              response: {},
              label: "needs approval",
              ok: false,
              halt: {
                reason: "confirmation_required" as const,
                toolName: "delete_task",
                summary: "Delete it",
                args: {},
              },
            }
          : { response: {}, label: "ran", ok: true };
      },
      () => false,
    );
    assert.equal(outcomes.length, 1);
    // The second call must never have executed — it is work the user is
    // still being asked about.
    assert.deepEqual(ran, ["delete_task"]);
  });
});

describe("operator coverage across modules", () => {
  test("every domain the operator claims to cover has at least one tool", () => {
    // The point of a single operator is that no module is a blind spot. A
    // domain with no tool means JARVIS must guess or refuse when asked
    // about it.
    const domains = new Set(listTools().map((t) => t.domain));
    for (const expected of [
      "tasks",
      "goals",
      "business",
      "finance",
      "university",
      "health",
      "calendar",
      "memory",
    ] as const) {
      assert.ok(domains.has(expected), `no tool covers the "${expected}" domain`);
    }
  });

  test("no tool exposes a field the schema does not have", () => {
    // deals has no probability column. A tool describing one would have the
    // model quoting a number with nothing behind it — the exact failure the
    // integration-status work exists to prevent, in a different guise.
    for (const tool of listTools()) {
      assert.doesNotMatch(
        tool.description.toLowerCase(),
        /probability/,
        `${tool.name} promises a probability field that does not exist`,
      );
    }
  });

  test("write tools that touch a record require an id", () => {
    // A write with no identifier either creates something or edits an
    // arbitrary row; update/complete/delete must always name their target.
    for (const tool of listTools()) {
      if (!/^(update|complete|delete|move)_/.test(tool.name)) continue;
      const declared = getToolDeclarations().find((d) => d.name === tool.name);
      const required = declared?.parameters.required ?? [];
      assert.ok(
        required.some((f) => f.endsWith("_id")),
        `${tool.name} must require an id`,
      );
    }
  });
});
