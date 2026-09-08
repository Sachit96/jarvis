import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyApproval } from "../lib/ai/approval.ts";
import { executeTool } from "../lib/ai/tools/executor.ts";
import { runToolRound } from "../lib/ai/providers/tool-round.ts";
import { getTool } from "../lib/ai/tools/registry.ts";
import type { AgentToolCall, AgentToolOutcome } from "../lib/ai/providers/types.ts";
import type { Client } from "../lib/ai/tools/types.ts";

/**
 * The confirmation journey, end to end: propose → gate → approve → execute,
 * and the two ways it must NOT go (declined, and one approval spent twice).
 *
 * These drive the real executor and the real registry — only the model and
 * the database are stubbed — because the property under test is precisely
 * that no model output can open the gate.
 */

/** Any handler that reaches this fails the test loudly. */
const noDb = new Proxy({}, {
  get() { throw new Error("a gate should have stopped this before the database"); },
}) as Client;

/** The one high-risk tool in the registry, discovered rather than hardcoded. */
const HIGH_RISK = "delete_task";
const TASK_ID = "11111111-1111-4111-8111-111111111111";

describe("approval accounting", () => {
  test("an unapproved call runs unconfirmed with the model's own arguments", () => {
    const d = applyApproval(undefined, { name: HIGH_RISK, args: { id: "a" } });
    assert.equal(d.confirmed, false);
    assert.deepEqual(d.args, { id: "a" });
  });

  test("an approval for a different tool does not open this one", () => {
    // Approving a deletion must not authorise, say, sending a message.
    const d = applyApproval(
      { toolName: "send_message", args: { body: "hi" } },
      { name: HIGH_RISK, args: { id: "a" } },
    );
    assert.equal(d.confirmed, false);
    assert.deepEqual(d.remaining, { toolName: "send_message", args: { body: "hi" } });
  });

  test("the approved arguments win over whatever the model re-emits", () => {
    // The user saw "delete task A" and said yes. The model then proposes
    // task B under the same name. B must not be what runs.
    const d = applyApproval(
      { toolName: HIGH_RISK, args: { id: "task-A" } },
      { name: HIGH_RISK, args: { id: "task-B" } },
    );
    assert.equal(d.confirmed, true);
    assert.deepEqual(d.args, { id: "task-A" });
  });

  test("one approval authorises exactly one execution", () => {
    const approval = { toolName: HIGH_RISK, args: { id: "task-A" } };
    const first = applyApproval(approval, { name: HIGH_RISK, args: { id: "task-A" } });
    assert.equal(first.confirmed, true);

    // The model asked to delete two things; the second must stop at the gate.
    const second = applyApproval(first.remaining, { name: HIGH_RISK, args: { id: "task-B" } });
    assert.equal(second.confirmed, false);
    assert.equal(second.remaining, undefined);
  });

  test("the approved arguments are copied, not aliased", () => {
    // A handler that mutated its arguments must not be able to edit the
    // record of what the user approved.
    const approval = { toolName: HIGH_RISK, args: { id: "task-A" } };
    const d = applyApproval(approval, { name: HIGH_RISK, args: {} });
    (d.args as Record<string, unknown>).id = "task-B";
    assert.deepEqual(approval.args, { id: "task-A" });
  });
});

describe("high-risk confirmation, end to end", () => {
  test("the registry still has a high-risk tool for this to be about", () => {
    // If delete_task were ever downgraded to low risk, the tests below would
    // pass vacuously. This is the guard against that.
    assert.equal(getTool(HIGH_RISK)?.risk, "high");
  });

  test("step 1-4: the tool does not execute, and the user is told what would happen", async () => {
    const result = await executeTool(HIGH_RISK, { task_id: TASK_ID }, {
      supabase: noDb,
    });
    assert.equal(result.status, "confirmation_required");
    if (result.status !== "confirmation_required") return;
    assert.equal(result.toolName, HIGH_RISK);
    // A summary the user can actually judge, not just the tool's name.
    assert.ok(result.summary.length > 0);
    // The arguments shown are the PARSED ones — what would really be written.
    assert.deepEqual(result.args, { task_id: TASK_ID });
  });

  test('step 5-6: "yes" replays the approved call and it reaches the handler', async () => {
    // noDb throws on property access, so reaching the handler surfaces as a
    // structured error rather than a confirmation_required. That the status
    // CHANGED is the proof the gate opened.
    const result = await executeTool(HIGH_RISK, { task_id: TASK_ID }, {
      supabase: noDb,
      confirmed: true,
    });
    assert.equal(result.status, "error");
  });

  test('"no" leaves the tool unexecuted — declining is simply never replaying it', async () => {
    // The decline path is the absence of a confirmed replay. Re-running the
    // same call unconfirmed must land back at the gate, never at the handler.
    const again = await executeTool(HIGH_RISK, { task_id: TASK_ID }, {
      supabase: noDb,
    });
    assert.equal(again.status, "confirmation_required");
  });

  test('"maybe" is not an approval — only an explicit confirmed flag is', async () => {
    // Whatever the voice layer makes of an ambiguous reply, it can only ever
    // hand the executor a boolean. Anything short of true stops here.
    for (const confirmed of [undefined, false]) {
      const result = await executeTool(HIGH_RISK, { task_id: TASK_ID }, {
        supabase: noDb,
        confirmed,
      });
      assert.equal(result.status, "confirmation_required", `confirmed=${confirmed} must not execute`);
    }
  });

  test("a halt stops the rest of the round, so a batch cannot slip past one prompt", async () => {
    const executed: string[] = [];
    const execute = async (call: AgentToolCall): Promise<AgentToolOutcome> => {
      const result = await executeTool(call.name, call.args, { supabase: noDb });
      if (result.status === "confirmation_required") {
        return {
          response: {}, label: "", ok: false,
          halt: { reason: "confirmation_required", toolName: result.toolName, summary: result.summary, args: result.args },
        };
      }
      executed.push(call.name);
      return { response: {}, label: "", ok: result.status === "ok" };
    };

        const outcomes = await runToolRound(
      [{ name: HIGH_RISK, args: { task_id: TASK_ID } }, { name: HIGH_RISK, args: { task_id: TASK_ID } }],
      execute,
      (name) => getTool(name)?.risk === "safe",
    );

    assert.equal(outcomes.length, 1, "the round stopped at the first confirmation");
    assert.equal(executed.length, 0);
  });
});
