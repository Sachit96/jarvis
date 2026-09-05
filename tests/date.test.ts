import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { todayStr } from "../lib/date.ts";

/**
 * Pinned to America/Toronto for this whole suite, not left to whatever
 * timezone the test runner happens to be in. Found live (2026-09-05): the
 * first version of this test constructed `new Date(2026, 8, 5, 23, 30, 0)`
 * and asserted it — which is trivially true in every timezone, since
 * `new Date(y, m, d, h, ...)` and `getFullYear/getMonth/getDate` both
 * resolve against whatever TZ the process is in, so the "local 11:30pm"
 * input and the "local calendar date" output always agree with each
 * other regardless of what that TZ actually is. That version of the test
 * verified todayStr() reads back what it was given — necessary, but it
 * never actually reproduced the UTC-crossing failure mode, so it proved
 * nothing about whether the bug this was written to catch is real. On a
 * UTC test runner in particular, 11:30pm local IS 11:30pm UTC — no
 * boundary crossed, so even the OLD broken pattern would have passed.
 *
 * Pinning TZ here and contrasting against the actual old pattern
 * (see the "regression" test below) is what makes this a real test
 * instead of one that happens to pass no matter what it's checking.
 */
describe("todayStr", () => {
  let originalTZ: string | undefined;
  before(() => {
    originalTZ = process.env.TZ;
    process.env.TZ = "America/Toronto";
  });
  after(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  test("returns the local calendar date at midday", () => {
    assert.equal(todayStr(new Date(2026, 8, 5, 12, 0, 0)), "2026-09-05");
  });

  test("returns the SAME local calendar date late in the evening", () => {
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

  /**
   * The actual regression guard: reproduces the old bug (the pattern
   * `new Date().toISOString().slice(0, 10)` replaced everywhere this
   * session) against the SAME 11:30pm-local input under the SAME pinned
   * America/Toronto timezone, and asserts it disagrees with todayStr() —
   * i.e. that the bug is real and reproducible, not just theoretical, and
   * that this fix actually differs from and corrects it. If someone
   * reintroduces the old pattern somewhere todayStr() should be used
   * instead, this is the test that would have caught it.
   */
  test("regression: the old toISOString().slice(0, 10) pattern gets this wrong; todayStr() doesn't", () => {
    const evening = new Date(2026, 8, 5, 23, 30, 0); // 11:30pm EDT, Sept 5
    const oldBuggyPattern = evening.toISOString().slice(0, 10);
    assert.equal(oldBuggyPattern, "2026-09-06", "sanity check that the bug is actually reproduced under this pinned timezone — if this fails, the test itself is no longer proving anything");
    assert.equal(todayStr(evening), "2026-09-05");
    assert.notEqual(todayStr(evening), oldBuggyPattern);
  });
});
