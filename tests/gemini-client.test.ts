import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  TIER_MODEL,
  TIER_DAILY_LIMIT,
  stripMarkdownFence,
  isRetryableStatus,
  isOverDailyLimit,
  withJitter,
} from "../lib/ai/providers/gemini-client.ts";

// callGemini() itself does real I/O (fetch + Supabase) and isn't mocked
// here — mocking that faithfully would need to fake two modules' worth of
// behavior to test logic that's actually just a handful of pure decisions.
// Those decisions (tier routing, the daily-budget boundary, which HTTP
// statuses retry, the jitter math) are exported as small pure
// functions/constants specifically so they're directly testable — this
// file tests the real exported logic, not a reimplementation of it.

describe("tier routing", () => {
  test("structured tier maps to gemini-3.5-flash-lite at 500 requests/day", () => {
    assert.equal(TIER_MODEL.structured, "gemini-3.5-flash-lite");
    assert.equal(TIER_DAILY_LIMIT.structured, 500);
  });

  test("high_volume tier maps to gemma-4-31b-it at 14,400 requests/day", () => {
    assert.equal(TIER_MODEL.high_volume, "gemma-4-31b-it");
    assert.equal(TIER_DAILY_LIMIT.high_volume, 14400);
  });
});

describe("isOverDailyLimit — the per-model budget boundary", () => {
  test("count exactly at the limit is still within budget", () => {
    assert.equal(isOverDailyLimit(500, 500), false);
  });

  test("count one over the limit trips it", () => {
    assert.equal(isOverDailyLimit(501, 500), true);
  });

  test("well under the limit is fine", () => {
    assert.equal(isOverDailyLimit(1, 14400), false);
  });
});

describe("isRetryableStatus — 429/500/503 backoff decision", () => {
  test("429 (rate limited) is retryable", () => {
    assert.equal(isRetryableStatus(429), true);
  });

  test("503 (transient high demand, observed live on the free-tier endpoint) is retryable", () => {
    assert.equal(isRetryableStatus(503), true);
  });

  test("500 is retryable — measured, not assumed", () => {
    // This assertion used to read the other way. The gemini:probe run of
    // 2026-09-09 sent the SAME payload three times to the same model and got
    // 200, then 500 INTERNAL, then 200 — including for a single trivially
    // valid declaration. A Google 500 is a server-side fault, not a verdict
    // on the request, and treating it as fatal turned a transient blip into a
    // failed operator turn.
    assert.equal(isRetryableStatus(500), true);
  });

  test("a rejected request is still not retried", () => {
    // 400 INVALID_ARGUMENT is a verdict on the payload: retrying only burns
    // budget to be told the same thing. This is what keeps the 500 change
    // from becoming "retry everything".
    for (const status of [400, 401, 403, 404, 422]) {
      assert.equal(isRetryableStatus(status), false, `${status} must not be retried`);
    }
    assert.equal(isRetryableStatus(200), false);
  });
});

describe("withJitter", () => {
  test("stays within ±25% of the input and is never negative", () => {
    for (let i = 0; i < 200; i++) {
      const input = 4000;
      const out = withJitter(input);
      assert.ok(out >= input * 0.75 && out <= input * 1.25, `${out} outside ±25% of ${input}`);
      assert.ok(out >= 0);
    }
  });

  test("handles the smallest real retry delay (1000ms) without going negative", () => {
    for (let i = 0; i < 50; i++) {
      assert.ok(withJitter(1000) >= 0);
    }
  });
});

describe("stripMarkdownFence", () => {
  test("strips a ```json ... ``` fence", () => {
    assert.equal(stripMarkdownFence('```json\n{"a":1}\n```'), '{"a":1}');
  });

  test("strips a bare ``` fence with no language tag", () => {
    assert.equal(stripMarkdownFence('```\n{"a":1}\n```'), '{"a":1}');
  });

  test("leaves already-clean JSON untouched", () => {
    assert.equal(stripMarkdownFence('{"a":1}'), '{"a":1}');
  });

  test("trims surrounding whitespace either way", () => {
    assert.equal(stripMarkdownFence('  \n{"a":1}\n  '), '{"a":1}');
  });
});
