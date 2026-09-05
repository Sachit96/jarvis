import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { matchesUngatedPrefix } from "../proxy.ts";

/**
 * Walking the auth carve-out (Cleanup work order): proxy.ts's own
 * UNGATED_PREFIXES check used a bare pathname.startsWith(prefix), which
 * also matches a path that merely shares the prefix's characters with no
 * path separator after it — e.g. "/api/research/runsomethingelse" would
 * incorrectly match "/api/research/runs". No such route exists today,
 * but the matcher itself should be correct regardless of what's added
 * later, not correct-by-coincidence because nothing has collided yet.
 */
describe("matchesUngatedPrefix", () => {
  const prefix = "/api/research/runs";

  test("matches the exact prefix path itself", () => {
    assert.equal(matchesUngatedPrefix("/api/research/runs", prefix), true);
  });

  test("matches a real sub-path", () => {
    assert.equal(matchesUngatedPrefix("/api/research/runs/abc-123", prefix), true);
    assert.equal(matchesUngatedPrefix("/api/research/runs/abc-123/cancel", prefix), true);
  });

  test("does NOT match a path that only shares the prefix as a character string, with no separator", () => {
    assert.equal(matchesUngatedPrefix("/api/research/runsomethingelse", prefix), false);
    assert.equal(matchesUngatedPrefix("/api/research/runs-legacy", prefix), false);
  });

  test("does not match an unrelated path", () => {
    assert.equal(matchesUngatedPrefix("/api/export/json", prefix), false);
    assert.equal(matchesUngatedPrefix("/", prefix), false);
  });
});
