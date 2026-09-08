import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { selectPriorityTasks, type TaskLike } from "../lib/life/task-views.ts";
import { buildExportPayload, EXPORT_TABLES } from "../lib/export.ts";

/**
 * Step 12/13: Home's numbers come from real queries, and no query runs twice.
 *
 * selectPriorityTasks is what let Home stop fetching the tasks table a second
 * time, so these lock in that it ranks identically to the query it replaced —
 * a cheaper Home that quietly reorders the shortlist would not be a win.
 */

function task(p: Partial<TaskLike> & { id: string }): TaskLike {
  return { title: p.id, status: "todo", priority: "medium", due_date: null, tags: [], ...p };
}

describe("priority shortlist", () => {
  test("ranks by priority first, due date within it", () => {
    const picked = selectPriorityTasks([
      task({ id: "low-soon", priority: "low", due_date: "2026-09-08" }),
      task({ id: "high-late", priority: "high", due_date: "2026-12-01" }),
      task({ id: "high-soon", priority: "high", due_date: "2026-09-09" }),
      task({ id: "med", priority: "medium", due_date: "2026-09-10" }),
    ]);
    assert.deepEqual(picked.map((t) => t.id), ["high-soon", "high-late", "med", "low-soon"]);
  });

  test("finished tasks are never on the shortlist", () => {
    // The query it replaced filtered these server-side with .neq("status","done").
    const picked = selectPriorityTasks([
      task({ id: "done", status: "done", priority: "high" }),
      task({ id: "open", priority: "low" }),
    ]);
    assert.deepEqual(picked.map((t) => t.id), ["open"]);
  });

  test("undated tasks sort behind dated ones of equal priority", () => {
    const picked = selectPriorityTasks([
      task({ id: "someday", priority: "high", due_date: null }),
      task({ id: "dated", priority: "high", due_date: "2026-10-01" }),
    ]);
    assert.deepEqual(picked.map((t) => t.id), ["dated", "someday"]);
  });

  test("an unknown priority sorts last instead of crashing the shortlist", () => {
    const picked = selectPriorityTasks([
      task({ id: "weird", priority: "urgent-ish" }),
      task({ id: "normal", priority: "low" }),
    ]);
    assert.deepEqual(picked.map((t) => t.id), ["normal", "weird"]);
  });

  test("honours the limit and does not mutate its input", () => {
    const input = [task({ id: "a" }), task({ id: "b" }), task({ id: "c" })];
    const snapshot = input.map((t) => t.id);
    assert.equal(selectPriorityTasks(input, 2).length, 2);
    assert.deepEqual(input.map((t) => t.id), snapshot);
  });
});

describe("JSON backup", () => {
  test("a table a migration removed is skipped, not fatal", async () => {
    // Migration 0029 is deliberately opt-in, so the export list has to span
    // both sides of it. Before this, the first absent table failed the whole
    // backup — the one thing 0029 tells you to do before running it.
    const supabase = {
      from(table: string) {
        return {
          select: async () =>
            table === "prayers" || table === "prayer_logs"
              ? { data: null, error: { code: "42P01", message: `relation "${table}" does not exist` } }
              : { data: [{ id: `${table}-row` }], error: null },
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const payload = await buildExportPayload(supabase);
    assert.deepEqual(payload.skipped.sort(), ["prayer_logs", "prayers"]);
    assert.equal(Object.keys(payload.data).length, EXPORT_TABLES.length - 2);
    assert.deepEqual(payload.data.tasks, [{ id: "tasks-row" }]);
  });

  test("a real failure still fails loudly", async () => {
    // A permissions or connection error must not produce a backup with
    // silent holes in it — that is worse than no backup.
    const supabase = {
      from() {
        return { select: async () => ({ data: null, error: { code: "42501", message: "permission denied" } }) };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await assert.rejects(() => buildExportPayload(supabase), /permission denied/);
  });
});
