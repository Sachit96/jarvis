import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { AnthropicLeadQualifier } from "../lib/ai/providers/anthropic-lead-qualifier.ts";
import type { AnthropicCallOptions, AnthropicCallResult } from "../lib/ai/providers/anthropic-client.ts";
import type { LeadSignals, PlaceResult } from "../lib/research/types.ts";

/**
 * Tests the bisection logic added after raising maxTokens (4096 -> 8192)
 * fixed one observed truncation without bounding the actual worst case.
 * No network call, no spend — AnthropicLeadQualifier takes an injectable
 * callModel (defaults to the real callAnthropic in production), so this
 * exercises the real recursion against a stubbed responder instead of
 * needing an actual >=20-lead run to prove the logic is sound.
 */

function fakePlace(i: number): PlaceResult {
  return {
    placeId: `place-${i}`,
    displayName: `Business ${i}`,
    formattedAddress: "123 Main St",
    lat: 43.6,
    lng: -79.4,
    rating: null,
    userRatingCount: null,
    websiteUri: null,
    nationalPhoneNumber: null,
    googleMapsUri: "",
    businessStatus: "OPERATIONAL",
  };
}

function makeSignalsList(n: number): LeadSignals[] {
  return Array.from({ length: n }, (_, i) => ({ place: fakePlace(i), hasWebsite: false, audit: null, pageSpeed: null }));
}

/** Counts how many businesses a given prompt actually asked about — buildBusinessSection labels each one "----- BUSINESS N of TOTAL -----". */
function businessCountIn(userContent: string): number {
  return (userContent.match(/----- BUSINESS \d+ of \d+ -----/g) ?? []).length;
}

function validQualificationJson(count: number): string {
  const item = {
    audit_summary: "No website found.",
    opportunities: [{ tag: "new_website", why: "No website at all — the strongest possible signal." }],
    score_breakdown: { website_quality: 0, conversion_readiness: 0, seo_basics: 0, performance: 0, digital_presence: 0 },
    ai_summary: "No website found — strong candidate for a new site.",
  };
  return JSON.stringify(Array.from({ length: count }, () => item));
}

describe("AnthropicLeadQualifier bisection", () => {
  test("recurses down to batches of 1 when every multi-business batch looks truncated, and succeeds once bisected", async () => {
    let callCount = 0;
    const stub = async (options: AnthropicCallOptions): Promise<AnthropicCallResult> => {
      callCount++;
      const n = businessCountIn(options.userContent);
      const text = n > 1 ? '{"not": "valid json for an array response' /* deliberately unterminated, mimics real truncation */ : validQualificationJson(1);
      return { text, inputTokens: 100, outputTokens: 50, costUsd: 0 };
    };

    const qualifier = new AnthropicLeadQualifier(stub);
    const outcomes = await qualifier.qualifyLeads(makeSignalsList(4));

    assert.equal(outcomes.length, 4);
    for (const outcome of outcomes) {
      assert.ok("result" in outcome && outcome.result, `expected every business to succeed after full bisection, got: ${JSON.stringify(outcome)}`);
    }
    // 1 call at size 4 (fails) + 2 calls at size 2 (both fail) + 4 calls at size 1 (all succeed) = 7.
    assert.equal(callCount, 7);
  });

  test("does NOT bisect a non-truncation failure — a malformed-shape response (valid JSON, not an array) fails the whole batch in one call", async () => {
    let callCount = 0;
    const stub = async (): Promise<AnthropicCallResult> => {
      callCount++;
      return { text: "{}", inputTokens: 100, outputTokens: 10, costUsd: 0 }; // valid JSON, but not an array — not truncation-shaped
    };

    const qualifier = new AnthropicLeadQualifier(stub);
    const outcomes = await qualifier.qualifyLeads(makeSignalsList(4));

    assert.equal(callCount, 1, "a non-truncation failure must not trigger any retry/bisection");
    assert.equal(outcomes.length, 4);
    for (const outcome of outcomes) {
      assert.ok("error" in outcome && outcome.error, "every business in the batch should report the same batch-level failure");
    }
  });

  test("does NOT bisect on a thrown (network/auth-shaped) error either", async () => {
    let callCount = 0;
    const stub = async (): Promise<AnthropicCallResult> => {
      callCount++;
      throw new Error("401 unauthorized");
    };

    const qualifier = new AnthropicLeadQualifier(stub);
    const outcomes = await qualifier.qualifyLeads(makeSignalsList(4));

    assert.equal(callCount, 1);
    assert.equal(outcomes.length, 4);
    for (const outcome of outcomes) {
      assert.ok("error" in outcome && outcome.error?.includes("401 unauthorized"));
    }
  });

  test("a wrong-length array (truncation-shaped) also triggers bisection, not just invalid JSON", async () => {
    let callCount = 0;
    const stub = async (options: AnthropicCallOptions): Promise<AnthropicCallResult> => {
      callCount++;
      const n = businessCountIn(options.userContent);
      // Always returns exactly 1 result, regardless of how many were asked for — wrong length whenever n > 1.
      return { text: validQualificationJson(n > 1 ? 1 : 1), inputTokens: 50, outputTokens: 20, costUsd: 0 };
    };

    const qualifier = new AnthropicLeadQualifier(stub);
    const outcomes = await qualifier.qualifyLeads(makeSignalsList(2));

    // size 2 (wrong length, 1 vs 2, truncated) -> bisects into two size-1 calls (correct length, succeed).
    assert.equal(callCount, 3);
    assert.equal(outcomes.length, 2);
    for (const outcome of outcomes) assert.ok("result" in outcome && outcome.result);
  });
});
