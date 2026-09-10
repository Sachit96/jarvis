import { test } from "node:test";
import assert from "node:assert/strict";
import { dueLabel, shortDate } from "../lib/date.ts";

test("due date labels", async (t) => {
  const today = "2026-09-10"; // a Thursday

  await t.test("past dates read as overdue, not as a date", () => {
    assert.equal(dueLabel("2026-09-08", today), "Overdue");
    assert.equal(dueLabel("2025-01-01", today), "Overdue");
  });

  await t.test("today and tomorrow are named", () => {
    assert.equal(dueLabel("2026-09-10", today), "Today");
    assert.equal(dueLabel("2026-09-11", today), "Tomorrow");
  });

  await t.test("inside the week the weekday is what matters", () => {
    assert.equal(dueLabel("2026-09-13", today), "Sunday");
    assert.equal(dueLabel("2026-09-16", today), "Wednesday");
  });

  await t.test("past a week, the date", () => {
    assert.equal(dueLabel("2026-09-17", today), "Sep 17");
    assert.equal(dueLabel("2026-12-01", today), "Dec 1");
  });

  await t.test("crossing a month boundary still counts days, not numbers", () => {
    assert.equal(dueLabel("2026-10-01", "2026-09-30"), "Tomorrow");
  });
});

test("past date labels", async (t) => {
  const today = "2026-09-10";

  await t.test("today and yesterday are named", () => {
    assert.equal(shortDate("2026-09-10", today), "Today");
    assert.equal(shortDate("2026-09-09", today), "Yesterday");
  });

  await t.test("this year drops the year", () => {
    assert.equal(shortDate("2026-08-31", today), "Aug 31");
  });

  await t.test("another year keeps it", () => {
    assert.equal(shortDate("2025-12-24", today), "Dec 24, 2025");
  });

  await t.test("crossing a month boundary backwards still finds yesterday", () => {
    assert.equal(shortDate("2026-08-31", "2026-09-01"), "Yesterday");
  });
});

test("timestamps are accepted wherever a date is", () => {
  // Callers hand these functions either a date column or a full timestamp.
  assert.equal(dueLabel("2026-09-08T23:00", "2026-09-10"), "Overdue");
  assert.equal(dueLabel("2026-09-10T09:30:00Z", "2026-09-10"), "Today");
  assert.equal(shortDate("2026-08-31T14:00", "2026-09-01"), "Yesterday");
});
