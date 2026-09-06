import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeLiveClockBlock, stripStaleClockLine } from "../lib/ai/persona.ts";

/**
 * Found live (2026-09-06): the pinned "NOW" memory entry states its
 * sprint's day-count as free text typed once on 2026-07-29 ("Days
 * remaining: 42") and never recomputed — the mentor was reporting "42
 * days remaining" on day 39 of a 42-day sprint, because that literal
 * string gets echoed into every prompt verbatim. These tests pin the
 * real NOW-entry body shape so a future edit to its markdown format
 * can't silently break the regex extraction without a test noticing.
 */

const REAL_NOW_BODY = `# NOW

## Clock
- **Sprint:** Week 1 of 6
- **Started:** 2026-07-29 · **Ends:** 2026-09-09
- **Days remaining:** 42

## Cash
Collected to date: $0
`;

describe("computeLiveClockBlock", () => {
  test("computes days remaining and week number from Started/Ends, not from the stale line", () => {
    const block = computeLiveClockBlock(REAL_NOW_BODY, "2026-09-06");
    assert.ok(block !== null);
    // Hand-verified: Jul29->Sep9 = 42 days total (6 full weeks). Jul29->Sep6 = 39 elapsed -> 3 remaining, week 6.
    assert.match(block!, /Week 6 of 6/);
    assert.match(block!, /3 day\(s\) remaining/);
    assert.doesNotMatch(block!, /42 day\(s\) remaining/, "must not just echo the stale '42' from the entry body");
  });

  test("on the sprint's first day, reports the full remaining span, not an off-by-one", () => {
    const block = computeLiveClockBlock(REAL_NOW_BODY, "2026-07-29");
    assert.match(block!, /Week 1 of 6/);
    assert.match(block!, /42 day\(s\) remaining/);
  });

  test("past the end date, reports the sprint as over instead of a negative day count", () => {
    const block = computeLiveClockBlock(REAL_NOW_BODY, "2026-09-15");
    assert.match(block!, /ENDED 6 day\(s\) ago/);
    assert.doesNotMatch(block!, /-6 day\(s\) remaining/);
  });

  test("returns null when the body has no parseable Started/Ends dates", () => {
    assert.equal(computeLiveClockBlock("no dates here", "2026-09-06"), null);
  });
});

describe("stripStaleClockLine", () => {
  test("removes both stale clock lines (Days remaining and Sprint: Week X of Y) and leaves everything else intact", () => {
    const stripped = stripStaleClockLine(REAL_NOW_BODY);
    assert.doesNotMatch(stripped, /Days remaining/);
    assert.doesNotMatch(stripped, /Sprint:\*\* Week/, "the stale 'Week 1 of 6' line must not survive alongside the live-computed week number");
    assert.match(stripped, /Started:\*\* 2026-07-29/);
    assert.match(stripped, /Collected to date: \$0/);
  });

  test("is a no-op when there's no such line to strip", () => {
    const body = "# Some other entry\nNo clock section here.";
    assert.equal(stripStaleClockLine(body), body);
  });
});
