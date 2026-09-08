import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  bucketFor,
  compareTasks,
  groupTasks,
  filterTasks,
  collectTags,
  type TaskLike,
} from "../lib/life/task-views.ts";
import {
  isDueOn,
  weekdayOf,
  describeCadence,
  dueDatesInRange,
  cadenceStreak,
} from "../lib/life/routine-cadence.ts";

function task(overrides: Partial<TaskLike> & Pick<TaskLike, "id">): TaskLike {
  return {
    title: "Task",
    status: "todo",
    priority: "medium",
    due_date: null,
    tags: [],
    ...overrides,
  };
}

const TODAY = "2026-09-08"; // a Tuesday

describe("task bucketing", () => {
  test("sorts by due date relative to today", () => {
    assert.equal(bucketFor(task({ id: "a", due_date: "2026-09-07" }), TODAY), "overdue");
    assert.equal(bucketFor(task({ id: "b", due_date: TODAY }), TODAY), "today");
    assert.equal(bucketFor(task({ id: "c", due_date: "2026-09-09" }), TODAY), "upcoming");
  });

  test("an undated task is someday, never overdue", () => {
    // It was never promised for a particular day; burying it in the overdue
    // pile makes that pile meaningless.
    assert.equal(bucketFor(task({ id: "a" }), TODAY), "someday");
  });

  test("done wins over an overdue date", () => {
    assert.equal(bucketFor(task({ id: "a", status: "done", due_date: "2020-01-01" }), TODAY), "done");
  });

  test("compares dates as strings, so a timezone cannot shift a due date", () => {
    // Parsing "2026-09-08" with new Date() reads it as UTC, which is the
    // previous day for anyone west of UTC — a task due today would show as
    // overdue. String comparison on ISO dates avoids that entirely.
    assert.equal(bucketFor(task({ id: "a", due_date: TODAY }), TODAY), "today");
    assert.notEqual(bucketFor(task({ id: "b", due_date: TODAY }), TODAY), "overdue");
  });

  test("groups and sorts in one pass", () => {
    const grouped = groupTasks(
      [
        task({ id: "late", due_date: "2026-09-01" }),
        task({ id: "soon", due_date: "2026-09-20" }),
        task({ id: "now", due_date: TODAY }),
        task({ id: "none" }),
        task({ id: "old", status: "done" }),
      ],
      TODAY,
    );
    assert.deepEqual(grouped.overdue.map((t) => t.id), ["late"]);
    assert.deepEqual(grouped.today.map((t) => t.id), ["now"]);
    assert.deepEqual(grouped.upcoming.map((t) => t.id), ["soon"]);
    assert.deepEqual(grouped.someday.map((t) => t.id), ["none"]);
    assert.deepEqual(grouped.done.map((t) => t.id), ["old"]);
  });

  test("within a bucket the deadline outranks priority", () => {
    // A low-priority item due today still has to happen before a
    // high-priority one due next week.
    const sooner = task({ id: "sooner", due_date: "2026-09-09", priority: "low" });
    const later = task({ id: "later", due_date: "2026-09-30", priority: "high" });
    assert.ok(compareTasks(sooner, later) < 0);
  });

  test("priority breaks ties on the same date", () => {
    const high = task({ id: "h", due_date: TODAY, priority: "high" });
    const low = task({ id: "l", due_date: TODAY, priority: "low" });
    assert.ok(compareTasks(high, low) < 0);
  });
});

describe("task filtering", () => {
  const tasks = [
    task({ id: "a", title: "Study ECN 104", tags: ["uni"], priority: "high" }),
    task({ id: "b", title: "Call supplier", description: "about pricing", tags: ["biz"] }),
    task({ id: "c", title: "Gym", tags: ["health", "uni"], priority: "low" }),
  ];

  test("searches title, description and tags", () => {
    assert.deepEqual(filterTasks(tasks, { query: "ecn" }).map((t) => t.id), ["a"]);
    assert.deepEqual(filterTasks(tasks, { query: "pricing" }).map((t) => t.id), ["b"]);
    assert.deepEqual(filterTasks(tasks, { query: "uni" }).map((t) => t.id), ["a", "c"]);
  });

  test("is case-insensitive", () => {
    assert.deepEqual(filterTasks(tasks, { query: "STUDY" }).map((t) => t.id), ["a"]);
  });

  test("combines filters conjunctively", () => {
    assert.deepEqual(filterTasks(tasks, { tag: "uni", priority: "low" }).map((t) => t.id), ["c"]);
  });

  test("an empty filter returns everything", () => {
    assert.equal(filterTasks(tasks, {}).length, 3);
  });

  test("collects a sorted, deduplicated tag list", () => {
    assert.deepEqual(collectTags(tasks), ["biz", "health", "uni"]);
  });
});

describe("routine cadence", () => {
  test("reads the weekday from a local midnight, not UTC", () => {
    // new Date("2026-09-08") is UTC midnight, which is Monday for anyone
    // west of UTC — the wrong weekday for a weekly routine.
    assert.equal(weekdayOf("2026-09-08"), 2); // Tuesday
    assert.equal(weekdayOf("2026-09-06"), 0); // Sunday
  });

  test("daily routines are due every day, including legacy rows with no cadence", () => {
    assert.equal(isDueOn({ cadence: "daily" }, TODAY), true);
    // Rows predating migration 0036 have no cadence set in memory; they must
    // keep behaving exactly as before.
    assert.equal(isDueOn({}, TODAY), true);
    assert.equal(isDueOn({ cadence: null, days_of_week: null }, TODAY), true);
  });

  test("weekly routines are due only on their chosen days", () => {
    const tuesdayRoutine = { cadence: "weekly", days_of_week: [2] };
    assert.equal(isDueOn(tuesdayRoutine, "2026-09-08"), true); // Tue
    assert.equal(isDueOn(tuesdayRoutine, "2026-09-09"), false); // Wed
  });

  test("a weekly routine with no days set is not due, rather than silently daily", () => {
    // Showing it every day would be indistinguishable from daily and would
    // undo the user's choice; hiding it makes the unfinished setup visible.
    assert.equal(isDueOn({ cadence: "weekly", days_of_week: [] }, TODAY), false);
  });

  test("describes its cadence for the UI and for tool results", () => {
    assert.equal(describeCadence({ cadence: "daily" }), "Daily");
    assert.equal(describeCadence({ cadence: "weekly", days_of_week: [1, 3] }), "Mon, Wed");
    assert.equal(describeCadence({ cadence: "weekly", days_of_week: [] }), "Weekly — no days set");
  });

  test("due dates in a range skip days the routine never runs", () => {
    const days = dueDatesInRange({ cadence: "weekly", days_of_week: [0] }, "2026-09-01", "2026-09-30");
    assert.deepEqual(days, ["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"]);
  });

  test("an inverted range yields nothing rather than looping", () => {
    assert.deepEqual(dueDatesInRange({ cadence: "daily" }, "2026-09-30", "2026-09-01"), []);
  });
});

describe("cadence streaks", () => {
  test("counts consecutive due days for a daily routine", () => {
    const done = new Set(["2026-09-05", "2026-09-06", "2026-09-07"]);
    assert.equal(cadenceStreak({ cadence: "daily" }, done, "2026-09-07"), 3);
  });

  test("today being incomplete does not break the streak", () => {
    // The day is not over yet.
    const done = new Set(["2026-09-06", "2026-09-07"]);
    assert.equal(cadenceStreak({ cadence: "daily" }, done, TODAY), 2);
  });

  test("a missed earlier day ends the streak", () => {
    const done = new Set(["2026-09-05", "2026-09-07"]);
    assert.equal(cadenceStreak({ cadence: "daily" }, done, "2026-09-07"), 1);
  });

  test("a weekly routine keeps its streak across the days it never runs", () => {
    // This is the whole reason cadence exists: on calendar days these four
    // Sundays are six days apart and would read as five misses each.
    const sundays = { cadence: "weekly", days_of_week: [0] };
    const done = new Set(["2026-08-16", "2026-08-23", "2026-08-30", "2026-09-06"]);
    assert.equal(cadenceStreak(sundays, done, "2026-09-06"), 4);
  });

  test("no completions is a zero streak", () => {
    assert.equal(cadenceStreak({ cadence: "daily" }, new Set(), TODAY), 0);
  });
});
