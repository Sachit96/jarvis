import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rankPriorities, topPriority, type PriorityInput } from "../lib/life/priority.ts";

const TODAY = "2026-09-08";

function input(overrides: Partial<PriorityInput> = {}): PriorityInput {
  return {
    today: TODAY,
    overdueTasks: [],
    tasksDueToday: [],
    universityDue: [],
    staleDeals: [],
    routine: { completed: 0, total: 0 },
    ...overrides,
  };
}

describe("JARVIS priority", () => {
  test("nothing pressing returns null rather than inventing urgency", () => {
    // A dashboard that always has something urgent to say trains the user
    // to ignore it. "Nothing is on fire" is real information.
    assert.equal(topPriority(input()), null);
  });

  test("an overdue assessment outranks an overdue task", () => {
    // A hard external deadline that has already passed is the one category
    // where the cost of missing it is not the user's to negotiate.
    const result = topPriority(
      input({
        universityDue: [{ id: "a", title: "Essay", due_at: "2026-09-05T23:59:00Z", course: "ECN 104" }],
        overdueTasks: [{ id: "t", title: "Email landlord", due_date: "2026-09-01" }],
      }),
    );
    assert.equal(result?.domain, "university");
    assert.match(result!.headline, /ECN 104 — Essay is overdue/);
  });

  test("an overdue task outranks something merely due today", () => {
    const result = topPriority(
      input({
        overdueTasks: [{ id: "t", title: "Invoice", due_date: "2026-09-01" }],
        tasksDueToday: [{ id: "u", title: "Groceries" }],
      }),
    );
    assert.match(result!.headline, /Invoice/);
  });

  test("routine chores rank below anything with a deadline", () => {
    const ranked = rankPriorities(
      input({
        tasksDueToday: [{ id: "u", title: "Groceries" }],
        routine: { completed: 1, total: 5 },
      }),
    );
    assert.equal(ranked[0].domain, "tasks");
    assert.equal(ranked[ranked.length - 1].domain, "routine");
  });

  test("assessments further than three days out are not urgent yet", () => {
    const ranked = rankPriorities(
      input({ universityDue: [{ id: "a", title: "Final", due_at: "2026-10-20T12:00:00Z" }] }),
    );
    assert.equal(ranked.length, 0);
  });

  test("counts the extra overdue tasks rather than listing them all", () => {
    const result = topPriority(
      input({
        overdueTasks: [
          { id: "1", title: "First", due_date: "2026-09-01" },
          { id: "2", title: "Second", due_date: "2026-09-02" },
          { id: "3", title: "Third", due_date: "2026-09-03" },
        ],
      }),
    );
    assert.match(result!.headline, /"First" is overdue, plus 2 others/);
  });

  test("chases the deal that has been silent longest", () => {
    const result = topPriority(
      input({
        staleDeals: [
          { label: "Acme", daysSinceStageChange: 6 },
          { label: "Globex", daysSinceStageChange: 21 },
        ],
      }),
    );
    assert.match(result!.headline, /Globex has been quiet for 21 days/);
  });

  test("a completed routine produces no candidate", () => {
    const ranked = rankPriorities(input({ routine: { completed: 4, total: 4 } }));
    assert.equal(ranked.length, 0);
  });

  test("every candidate carries somewhere to act on it", () => {
    const ranked = rankPriorities(
      input({
        universityDue: [{ id: "a", title: "Quiz", due_at: "2026-09-08T09:00:00Z" }],
        overdueTasks: [{ id: "t", title: "Thing", due_date: "2026-09-01" }],
        staleDeals: [{ label: "Acme", daysSinceStageChange: 9 }],
        routine: { completed: 0, total: 3 },
      }),
    );
    assert.ok(ranked.length >= 4);
    for (const c of ranked) assert.match(c.href, /^\//, `${c.domain} needs a destination`);
  });

  test("is deterministic — same input, same answer", () => {
    // The whole reason this is a ranking and not a model call.
    const args = input({ overdueTasks: [{ id: "t", title: "Thing", due_date: "2026-09-01" }] });
    assert.deepEqual(rankPriorities(args), rankPriorities(args));
  });
});
