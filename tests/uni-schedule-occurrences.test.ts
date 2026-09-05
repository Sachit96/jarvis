import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { expandWeeklyOccurrences } from "../lib/uni/schedule-occurrences.ts";

describe("expandWeeklyOccurrences", () => {
  test("projects a single weekly block across a month range", () => {
    // September 2026: Tuesdays fall on 1, 8, 15, 22, 29.
    const occurrences = expandWeeklyOccurrences(
      [{ day_of_week: 2, id: "ecn104" }],
      new Date(2026, 8, 1),
      new Date(2026, 8, 30),
    );
    assert.deepEqual(
      occurrences.map((o) => o.date),
      ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"],
    );
  });

  test("handles multiple blocks on the same day of week, same date", () => {
    const occurrences = expandWeeklyOccurrences(
      [
        { day_of_week: 1, id: "gms200" },
        { day_of_week: 1, id: "qms110" },
      ],
      new Date(2026, 8, 7),
      new Date(2026, 8, 7),
    );
    assert.equal(occurrences.length, 2);
    assert.deepEqual(occurrences.map((o) => o.item.id).sort(), ["gms200", "qms110"]);
  });

  test("a block whose day never falls in a single-day range produces nothing", () => {
    // Sept 4, 2026 is a Friday (day_of_week 5) — a Tuesday block shouldn't appear.
    const occurrences = expandWeeklyOccurrences([{ day_of_week: 2, id: "ecn104" }], new Date(2026, 8, 4), new Date(2026, 8, 4));
    assert.equal(occurrences.length, 0);
  });

  test("empty input list returns no occurrences regardless of range", () => {
    const occurrences = expandWeeklyOccurrences([], new Date(2026, 8, 1), new Date(2026, 11, 7));
    assert.equal(occurrences.length, 0);
  });

  test("an inverted range (end before start) returns no occurrences", () => {
    const occurrences = expandWeeklyOccurrences([{ day_of_week: 1, id: "x" }], new Date(2026, 8, 10), new Date(2026, 8, 1));
    assert.equal(occurrences.length, 0);
  });
});
