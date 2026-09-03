import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ANTHROPIC_PRICING, ANTHROPIC_MODEL, computeCostUsd, isOverSpendCap } from "../lib/ai/providers/anthropic-client.ts";

// callAnthropic() itself does real I/O (fetch + Supabase spend lookups) —
// not mocked here, same reasoning as gemini-client.test.ts. computeCostUsd
// and isOverSpendCap are the two pieces of actual decision logic
// ("tokens x rate -> dollars", "does the cap block") and are exported
// specifically so they're directly testable.

describe("computeCostUsd — tokens x rate -> dollars", () => {
  test("matches the real call verified live this project: 44 input + 17 output tokens on claude-sonnet-5 = $0.000258", () => {
    // From the live verification: $0.000258 for 44 input + 17 output
    // tokens, independently recomputed and confirmed exact.
    const cost = computeCostUsd(ANTHROPIC_MODEL, 44, 17);
    assert.equal(Math.round(cost * 1_000_000) / 1_000_000, 0.000258);
  });

  test("1 MTok input + 1 MTok output on claude-sonnet-5 costs exactly input+output MTok rates", () => {
    const rate = ANTHROPIC_PRICING["claude-sonnet-5"];
    const cost = computeCostUsd("claude-sonnet-5", 1_000_000, 1_000_000);
    assert.equal(cost, rate.inputPerMTok + rate.outputPerMTok);
  });

  test("input and output are priced independently, not at a blended rate", () => {
    const inputOnly = computeCostUsd("claude-sonnet-5", 1_000_000, 0);
    const outputOnly = computeCostUsd("claude-sonnet-5", 0, 1_000_000);
    assert.equal(inputOnly, ANTHROPIC_PRICING["claude-sonnet-5"].inputPerMTok);
    assert.equal(outputOnly, ANTHROPIC_PRICING["claude-sonnet-5"].outputPerMTok);
    assert.notEqual(inputOnly, outputOnly); // input/output rates genuinely differ ($2 vs $10)
  });

  test("zero tokens costs zero", () => {
    assert.equal(computeCostUsd("claude-sonnet-5", 0, 0), 0);
  });

  test("an unknown model never blocks on a pricing-table gap — costs 0 rather than throwing", () => {
    assert.equal(computeCostUsd("some-future-model-not-in-the-table", 1000, 1000), 0);
  });

  test("claude-opus-5 and claude-haiku-4-5 use their own distinct rates, not sonnet's", () => {
    const opus = computeCostUsd("claude-opus-5", 1_000_000, 1_000_000);
    const sonnet = computeCostUsd("claude-sonnet-5", 1_000_000, 1_000_000);
    const haiku = computeCostUsd("claude-haiku-4-5", 1_000_000, 1_000_000);
    assert.ok(opus > sonnet, "opus should cost more than sonnet per the pricing table");
    assert.ok(sonnet > haiku, "sonnet should cost more than haiku per the pricing table");
  });
});

describe("isOverSpendCap — the cap boundary that blocks a call", () => {
  test("spend exactly at the cap blocks (>=, not >)", () => {
    // Verified live this project by temporarily lowering the cap: spend
    // reaching the cap correctly blocks rather than allowing one more call.
    assert.equal(isOverSpendCap(3.0, 3.0), true);
  });

  test("spend just under the cap is still allowed", () => {
    assert.equal(isOverSpendCap(2.99, 3.0), false);
  });

  test("spend over the cap blocks", () => {
    assert.equal(isOverSpendCap(3.01, 3.0), true);
  });

  test("zero spend against the default $3 cap is allowed", () => {
    assert.equal(isOverSpendCap(0, 3.0), false);
  });
});
