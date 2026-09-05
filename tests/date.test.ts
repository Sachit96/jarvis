import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { todayStr } from "../lib/date.ts";

describe("todayStr", () => {
  test("returns the local calendar date at midday — the case that always passed", () => {
    assert.equal(todayStr(new Date(2026, 8, 5, 12, 0, 0)), "2026-09-05");
  });

  test("returns the SAME local calendar date late in the evening — this is the case toISOString().slice(0, 10) got wrong", () => {
    // 11:30pm local, Sept 5. The old `new Date().toISOString().slice(0, 10)`
    // pattern converts to UTC before slicing, which rolls into "2026-09-06"
    // for any runtime with a negative UTC offset once local time-of-day
    // plus the offset crosses midnight (e.g. EDT, UTC-4, past ~8pm) — a
    // real bug found live this session in uni-calendar.tsx, workout-
    // calendar.tsx, and business/dashboard/page.tsx. A deterministic Date
    // input here means this test can't accidentally pass just because it
    // happened to run before 8pm.
    assert.equal(todayStr(new Date(2026, 8, 5, 23, 30, 0)), "2026-09-05");
  });

  test("returns the correct date just after midnight, not the day before", () => {
    assert.equal(todayStr(new Date(2026, 8, 5, 0, 5, 0)), "2026-09-05");
  });

  test("pads single-digit month and day", () => {
    assert.equal(todayStr(new Date(2026, 0, 5, 9, 0, 0)), "2026-01-05");
  });

  test("defaults to the real current date when called with no argument", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    assert.equal(todayStr(), expected);
  });
});
