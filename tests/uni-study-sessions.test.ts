import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bucketFor,
  dayKey,
  formatMinutes,
  groupSessions,
  todaysPlan,
  totalsFor,
  type StudySessionLike,
} from "../lib/uni/study-sessions";

function session(over: Partial<StudySessionLike> & { id: string; planned_start: string }): StudySessionLike {
  return {
    course_id: "c1",
    assessment_id: null,
    planned_minutes: 60,
    actual_minutes: null,
    completed: false,
    notes: null,
    ...over,
  };
}

test("dayKey uses the local calendar date, not the UTC one", () => {
  // A 7pm local timestamp: slicing the ISO string would push this onto the
  // next day anywhere west of UTC, which is the bug this exists to avoid.
  const local = new Date(2026, 8, 10, 19, 0, 0);
  assert.equal(dayKey(local.toISOString()), "2026-09-10");
});

test("a session planned earlier today is still tonight's, not missed", () => {
  const today = "2026-09-10";
  const morning = new Date(2026, 8, 10, 8, 0, 0).toISOString();
  assert.equal(bucketFor(session({ id: "a", planned_start: morning }), today), "today");
});

test("a completed session is done no matter when it was planned", () => {
  const today = "2026-09-10";
  const lastWeek = new Date(2026, 8, 3, 19, 0, 0).toISOString();
  // Finishing Tuesday's block on Wednesday is a success, not a miss.
  assert.equal(
    bucketFor(session({ id: "a", planned_start: lastWeek, completed: true }), today),
    "done",
  );
  assert.equal(bucketFor(session({ id: "b", planned_start: lastWeek }), today), "overdue");
});

test("groups sort soonest-first, except done which is newest-first", () => {
  const today = "2026-09-10";
  const at = (d: number, h: number) => new Date(2026, 8, d, h, 0, 0).toISOString();
  const grouped = groupSessions(
    [
      session({ id: "later", planned_start: at(12, 9) }),
      session({ id: "sooner", planned_start: at(11, 9) }),
      session({ id: "old-done", planned_start: at(1, 9), completed: true }),
      session({ id: "new-done", planned_start: at(9, 9), completed: true }),
    ],
    today,
  );
  assert.deepEqual(grouped.upcoming.map((s) => s.id), ["sooner", "later"]);
  assert.deepEqual(grouped.done.map((s) => s.id), ["new-done", "old-done"]);
});

test("totals prefer actual minutes but fall back to planned", () => {
  const at = new Date(2026, 8, 10, 19, 0, 0).toISOString();
  const totals = totalsFor([
    session({ id: "a", planned_start: at, planned_minutes: 60, completed: true, actual_minutes: 45 }),
    // Ticked off without recording a figure: the honest reading is that the
    // planned block happened.
    session({ id: "b", planned_start: at, planned_minutes: 30, completed: true }),
    session({ id: "c", planned_start: at, planned_minutes: 90 }),
  ]);
  assert.equal(totals.plannedMinutes, 180);
  assert.equal(totals.completedMinutes, 75);
  assert.equal(totals.completedCount, 2);
  assert.equal(totals.totalCount, 3);
});

test("no sessions is zero, not NaN", () => {
  assert.deepEqual(totalsFor([]), {
    plannedMinutes: 0,
    completedMinutes: 0,
    completedCount: 0,
    totalCount: 0,
  });
});

test("durations read as a human would say them", () => {
  assert.equal(formatMinutes(0), "0m");
  assert.equal(formatMinutes(45), "45m");
  assert.equal(formatMinutes(60), "1h");
  assert.equal(formatMinutes(90), "1h 30m");
  assert.equal(formatMinutes(-5), "0m");
});

test("today's counter measures the day's plan, not the unfinished part of it", () => {
  // The regression: building today's totals from the overdue+today display
  // buckets meant ticking a block removed it from BOTH the numerator and the
  // denominator, so "done today" never moved off 0m.
  const today = "2026-09-10";
  const at = (h: number) => new Date(2026, 8, 10, h, 0, 0).toISOString();
  const sessions = [
    session({ id: "a", planned_start: at(19), planned_minutes: 90, completed: true }),
    session({ id: "b", planned_start: at(21), planned_minutes: 45 }),
    session({ id: "yesterday", planned_start: new Date(2026, 8, 9, 19).toISOString(), planned_minutes: 60 }),
  ];
  const totals = totalsFor(todaysPlan(sessions, today));
  assert.equal(totals.plannedMinutes, 135, "yesterday's block is not part of today's plan");
  assert.equal(totals.completedMinutes, 90, "a finished block counts toward today");
  assert.equal(totals.completedCount, 1);
});

test("completing every block reports the full plan as done", () => {
  const today = "2026-09-10";
  const at = (h: number) => new Date(2026, 8, 10, h, 0, 0).toISOString();
  const totals = totalsFor(
    todaysPlan(
      [
        session({ id: "a", planned_start: at(19), planned_minutes: 60, completed: true }),
        session({ id: "b", planned_start: at(21), planned_minutes: 30, completed: true }),
      ],
      today,
    ),
  );
  assert.equal(totals.completedMinutes, totals.plannedMinutes);
});
