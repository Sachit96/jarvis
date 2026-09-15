import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  toMinutes, formatTime, byDay, gridRange, nowContext,
  currentBlock, nextClass, describeUntil, type TimetableBlock,
} from "../lib/uni/timetable.ts";

const block = (p: Partial<TimetableBlock> & { id: string }): TimetableBlock => ({
  course_id: "c1", day_of_week: 1, start_time: "09:00", end_time: "10:30",
  room: null, type: "lecture", ...p,
});

describe("time parsing", () => {
  test("handles both HH:MM and Postgres time output", () => {
    assert.equal(toMinutes("09:30"), 570);
    assert.equal(toMinutes("09:30:00"), 570);
  });

  test("rejects a value that is not a time rather than guessing", () => {
    for (const bad of ["", "tomorrow", "25:00", "09:99"]) assert.equal(toMinutes(bad), null);
  });

  test("formats without a stray :00", () => {
    assert.equal(formatTime("09:00"), "9am");
    assert.equal(formatTime("13:30"), "1:30pm");
    assert.equal(formatTime("12:00"), "12pm");
    assert.equal(formatTime("00:15"), "12:15am");
  });
});

describe("the grid", () => {
  test("spans only the hours that have classes", () => {
    // A fixed midnight-to-midnight grid is mostly empty space on any real
    // timetable.
    const range = gridRange([
      block({ id: "a", start_time: "10:00", end_time: "11:00" }),
      block({ id: "b", start_time: "14:00", end_time: "15:30" }),
    ]);
    assert.deepEqual(range, { startHour: 10, endHour: 16 });
  });

  test("rounds the end up so a half-hour finish is not clipped", () => {
    const range = gridRange([block({ id: "a", start_time: "09:00", end_time: "17:30" })]);
    assert.equal(range.endHour, 18);
  });

  test("an empty timetable still looks like a teaching day", () => {
    assert.deepEqual(gridRange([]), { startHour: 8, endHour: 18 });
  });

  test("every weekday gets a column, including empty ones", () => {
    const days = byDay([block({ id: "a", day_of_week: 3 })]);
    assert.equal(days.length, 7);
    assert.equal(days[3].blocks.length, 1);
    assert.equal(days[0].blocks.length, 0);
  });

  test("a day's blocks come out in time order", () => {
    const days = byDay([
      block({ id: "late", day_of_week: 2, start_time: "15:00" }),
      block({ id: "early", day_of_week: 2, start_time: "08:00" }),
    ]);
    assert.deepEqual(days[2].blocks.map((b) => b.id), ["early", "late"]);
  });
});

describe("current class", () => {
  const monday930 = nowContext(new Date(2026, 8, 7, 9, 30)); // a Monday

  test("finds the class in progress", () => {
    const found = currentBlock([block({ id: "now", day_of_week: 1 })], monday930);
    assert.equal(found?.id, "now");
  });

  test("a class that just ended is not current", () => {
    // Exclusive of end: at 10:30 the 09:00-10:30 lecture is over.
    const at1030 = nowContext(new Date(2026, 8, 7, 10, 30));
    assert.equal(currentBlock([block({ id: "a", day_of_week: 1 })], at1030), null);
  });

  test("a class starting exactly now IS current", () => {
    const at900 = nowContext(new Date(2026, 8, 7, 9, 0));
    assert.equal(currentBlock([block({ id: "a", day_of_week: 1 })], at900)?.id, "a");
  });

  test("the same time on a different weekday is not current", () => {
    const found = currentBlock([block({ id: "tue", day_of_week: 2 })], monday930);
    assert.equal(found, null);
  });
});

describe("next class", () => {
  const monday930 = nowContext(new Date(2026, 8, 7, 9, 30));

  test("prefers a later class today over one tomorrow", () => {
    const next = nextClass([
      block({ id: "tomorrow", day_of_week: 2, start_time: "09:00" }),
      block({ id: "later-today", day_of_week: 1, start_time: "14:00" }),
    ], monday930);
    assert.equal(next?.block.id, "later-today");
    assert.equal(next?.daysAhead, 0);
    assert.equal(next?.minutesUntil, 270);
  });

  test("wraps around the week when nothing is left", () => {
    // Sunday's class is six days away, not "already passed".
    const next = nextClass([block({ id: "sun", day_of_week: 0, start_time: "10:00" })], monday930);
    assert.equal(next?.block.id, "sun");
    assert.equal(next?.daysAhead, 6);
  });

  test("today's earlier class becomes next week's, not now", () => {
    const next = nextClass([block({ id: "past", day_of_week: 1, start_time: "08:00" })], monday930);
    assert.equal(next?.daysAhead, 7);
  });

  test("a class in progress is not the NEXT class", () => {
    // 09:00-10:30 is current at 09:30; next should be the afternoon one.
    const next = nextClass([
      block({ id: "current", day_of_week: 1, start_time: "09:00", end_time: "10:30" }),
      block({ id: "after", day_of_week: 1, start_time: "13:00" }),
    ], monday930);
    assert.equal(next?.block.id, "after");
  });

  test("an empty timetable has no next class", () => {
    assert.equal(nextClass([], monday930), null);
  });
});

describe("countdown wording", () => {
  test("reads naturally at each scale", () => {
    assert.equal(describeUntil(25), "in 25 min");
    assert.equal(describeUntil(190), "in 3h 10m");
    assert.equal(describeUntil(180), "in 3h");
    assert.equal(describeUntil(24 * 60), "tomorrow");
    assert.equal(describeUntil(4 * 24 * 60), "in 4 days");
  });
});

test("occursOn keeps cancelled days out of current/next", async (t) => {
  const blocks = [
    { id: "b1", course_id: "c1", day_of_week: 1, start_time: "09:00", end_time: "10:00", room: null, type: "lecture" },
    { id: "b2", course_id: "c1", day_of_week: 3, start_time: "09:00", end_time: "10:00", room: null, type: "lecture" },
  ];
  // Monday 09:30 — mid-class.
  const now = { dayOfWeek: 1, minutes: 570 };

  await t.test("without a predicate the Monday class is current", () => {
    assert.equal(currentBlock(blocks, now)?.id, "b1");
  });

  await t.test("a suspended today has no current class", () => {
    assert.equal(currentBlock(blocks, now, () => false), null);
  });

  await t.test("next skips days that do not run", () => {
    // Only Wednesday (2 days ahead) survives.
    const next = nextClass(blocks, now, (_b, daysAhead) => daysAhead === 2);
    assert.equal(next?.block.id, "b2");
    assert.equal(next?.daysAhead, 2);
  });

  await t.test("a full week off yields no next class rather than a guess", () => {
    assert.equal(nextClass(blocks, now, () => false), null);
  });
});
