import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toUserFacingError } from "../lib/ai/user-error.ts";

/**
 * Step 8: the user must never see a stack trace, a raw Supabase error, an
 * API secret, or an internal implementation detail. The chat renders these
 * strings as assistant bubbles, so anything that leaks here is spoken in
 * JARVIS's voice.
 */

// Silence the deliberate server-side logging these tests trigger.
const quiet = <T,>(fn: () => T): T => {
  const original = console.error;
  console.error = () => {};
  try { return fn(); } finally { console.error = original; }
};

describe("user-facing errors", () => {
  test("a raw Postgres error never reaches the user", () => {
    const result = quiet(() => toUserFacingError(
      new Error('relation "mentor_messages" does not exist'),
      "test",
    ));
    assert.doesNotMatch(result.message, /relation|mentor_messages|does not exist/);
  });

  test("a constraint violation does not disclose schema", () => {
    const result = quiet(() => toUserFacingError(
      new Error('new row violates check constraint "habits_days_of_week_valid"'),
      "test",
    ));
    assert.doesNotMatch(result.message, /constraint|habits_|violates/);
  });

  test("a stack trace never reaches the user", () => {
    const error = new Error("boom");
    const result = quiet(() => toUserFacingError(error, "test"));
    assert.doesNotMatch(result.message, /\.ts:\d+|at \w+ \(/);
  });

  test("an env var name is not shown, but the user is pointed somewhere useful", () => {
    const result = quiet(() => toUserFacingError(new Error("GEMINI_API_KEY is not configured"), "test"));
    assert.doesNotMatch(result.message, /GEMINI_API_KEY|process\.env/);
    assert.match(result.message, /Settings/);
  });

  test("a leaked secret in an error body is never echoed", () => {
    // Defence in depth: the Gemini client already refuses to put the key or
    // the response body into an error. If that ever regressed, this layer is
    // the last thing between it and the screen.
    const result = quiet(() => toUserFacingError(
      new Error("request failed: key=AIzaSyFAKE_TEST_VALUE_000000000000000"),
      "test",
    ));
    assert.doesNotMatch(result.message, /AIza|key=/);
  });

  test("quota exhaustion is explained, because the user can act on it", () => {
    const result = quiet(() => toUserFacingError(
      new Error("gemini-3.5-flash-lite daily budget exhausted (1000 requests/day) — resets at midnight UTC."),
      "test",
    ));
    assert.match(result.message, /quota|midnight/i);
    // The model name is an implementation detail; the reset time is not.
    assert.doesNotMatch(result.message, /gemini-|flash-lite/);
  });

  test("a rate limit keeps its distinct signal for Voice's shorter reply", () => {
    const result = quiet(() => toUserFacingError(new Error("Gemini request failed: 429 Too Many Requests"), "test"));
    assert.equal(result.rateLimited, true);
    assert.doesNotMatch(result.message, /429/);
  });

  test("an unrecognised failure still says nothing was changed", () => {
    const result = quiet(() => toUserFacingError(new Error("ECONNRESET at Socket._onTimeout"), "test"));
    assert.match(result.message, /Nothing was changed/);
    assert.doesNotMatch(result.message, /ECONNRESET|Socket/);
  });

  test("a non-Error throw is handled too", () => {
    const result = quiet(() => toUserFacingError({ code: "PGRST301", detail: "secret" }, "test"));
    assert.doesNotMatch(result.message, /PGRST301|secret/);
  });

  test("the real error is still logged server-side", () => {
    // Losing the detail entirely would trade one problem for a worse one.
    const original = console.error;
    const logged: unknown[] = [];
    console.error = (...args: unknown[]) => { logged.push(args); };
    try {
      toUserFacingError(new Error("the real cause"), "some-context");
    } finally {
      console.error = original;
    }
    assert.equal(logged.length, 1);
    assert.match(JSON.stringify((logged[0] as unknown[])[0]), /some-context/);
  });
});
