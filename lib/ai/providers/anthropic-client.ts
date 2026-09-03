import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingRelation } from "@/lib/db/missing-relation";

/**
 * Anthropic — the only paid path in this app. No ongoing free tier (a
 * one-time trial credit, then pay-per-token), unlike every Gemini tier
 * used elsewhere here. Model ID and pricing below were verified against
 * current Anthropic documentation before writing this (via the claude-api
 * skill), not recalled from training data, per the work order's explicit
 * instruction not to hardcode a model string from memory.
 *
 * Model choice: claude-sonnet-5, not claude-opus-5 (Anthropic's own
 * general guidance defaults to Opus 5 unless a cheaper model is
 * explicitly warranted) — deliberate here because this app's own spend
 * cap defaults to $3 total, and lead qualification is a moderate-
 * complexity structured-output task, not a task that needs Opus-tier
 * reasoning. Opus 5 ($5/$25 per MTok) would burn through that cap in a
 * handful of calls; Sonnet 5 ($2/$10 per MTok) buys meaningfully more
 * runway at output quality this task doesn't need Opus for. Change this
 * constant (and ANTHROPIC_PRICING below) if that tradeoff should move.
 */
export const ANTHROPIC_MODEL = "claude-sonnet-5";
export const ANTHROPIC_API_VERSION = "2023-06-01";
export const DEFAULT_SPEND_CAP_USD = 3.0;

/** $/MTok, verified current as of this build — not a guess. Keyed by model so cost is computed from real usage x real rate, not a flat per-request estimate. */
export const ANTHROPIC_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-opus-5": { inputPerMTok: 5.0, outputPerMTok: 25.0 },
  "claude-sonnet-5": { inputPerMTok: 2.0, outputPerMTok: 10.0 },
  "claude-haiku-4-5": { inputPerMTok: 1.0, outputPerMTok: 5.0 },
};

/** Exported for tests/anthropic-client.test.ts — the actual tokens x rate -> dollars math, not a copy of it. */
export function computeCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = ANTHROPIC_PRICING[model];
  if (!rate) return 0; // unknown model — never block on a pricing-table gap, but this should be caught in review before it ships
  return (inputTokens / 1_000_000) * rate.inputPerMTok + (outputTokens / 1_000_000) * rate.outputPerMTok;
}

/** The exact boundary callAnthropic's spend guard checks (`spent >= cap` blocks) — extracted so it's directly testable without mocking Supabase. */
export function isOverSpendCap(spent: number, cap: number): boolean {
  return spent >= cap;
}

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
  return key;
}

export async function getAnthropicSpendCap(): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("anthropic_settings").select("spend_cap_usd").eq("id", true).maybeSingle();
  return data?.spend_cap_usd ?? DEFAULT_SPEND_CAP_USD;
}

export async function getAnthropicSpendToDate(): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("anthropic_usage").select("cost_usd");
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd), 0);
}

/**
 * True only when spend tracking is actually WORKING — anthropic_usage
 * exists and is queryable — not just when a query returns no error-free
 * rows. This matters more than the usual "degrade gracefully" case:
 * before migration 0025 runs, a naive read of "0 spent so far" would
 * read as safely under the cap and let isAnthropicAvailable() route real,
 * PAID calls through with no working spend cap to stop them — the
 * opposite of graceful degradation, an unmetered-spend hole. So this
 * checks the query's own error code explicitly rather than reusing the
 * "missing table = empty result" pattern the read-only query helpers use
 * elsewhere.
 */
async function isSpendTrackingAvailable(): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("anthropic_usage").select("id").limit(1);
  return !isMissingRelation(error);
}

/** True only when ANTHROPIC_API_KEY is set, spend tracking is actually working, AND lifetime spend is still under the configured cap — the single gate getLeadQualifier() checks before ever choosing the Anthropic path. */
export async function isAnthropicAvailable(): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  if (!(await isSpendTrackingAvailable())) return false;
  const [cap, spent] = await Promise.all([getAnthropicSpendCap(), getAnthropicSpendToDate()]);
  return !isOverSpendCap(spent, cap);
}

export interface AnthropicCallOptions {
  system: string;
  userContent: string;
  /** JSON Schema (standard lowercase types — NOT Gemini's uppercase OpenAPI dialect), per output_config.format:{type:"json_schema"}. */
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
}

export interface AnthropicCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/**
 * Raw fetch, not the SDK — matches this app's existing gemini-client.ts
 * pattern (see its own comment on why: this app has no external SDK
 * dependency for LLM calls anywhere, deliberately).
 *
 * Enforces the spend cap BEFORE making the call (checked against
 * lifetime spend so far), and records the call's real cost into
 * anthropic_usage immediately after — same "check before, log after,
 * regardless of outcome" discipline as gemini_usage's per-request
 * counter, just dollar-denominated instead of request-denominated.
 */
export async function callAnthropic(options: AnthropicCallOptions): Promise<AnthropicCallResult> {
  // Re-checked here too (not just by isAnthropicAvailable() upstream in
  // getLeadQualifier()) since this function is itself exported and
  // callable directly — and specifically checks that tracking is
  // WORKING, not just "no spend recorded yet", so a missing
  // anthropic_usage table blocks the call instead of reading as an
  // empty-therefore-safe budget. See isSpendTrackingAvailable's comment.
  if (!(await isSpendTrackingAvailable())) {
    throw new Error("Anthropic spend tracking isn't set up yet (migration 0025 hasn't run) — refusing to make an unmetered paid call.");
  }
  const [cap, spent] = await Promise.all([getAnthropicSpendCap(), getAnthropicSpendToDate()]);
  if (isOverSpendCap(spent, cap)) {
    throw new Error(`Anthropic spend cap reached ($${spent.toFixed(2)} / $${cap.toFixed(2)}) — configure a higher cap in Settings to continue.`);
  }

  const body: Record<string, unknown> = {
    model: ANTHROPIC_MODEL,
    max_tokens: options.maxTokens ?? 4096,
    system: options.system,
    messages: [{ role: "user", content: options.userContent }],
    // No `temperature` — verified live tonight that claude-sonnet-5
    // rejects it outright: {"type":"invalid_request_error","message":
    // "`temperature` is deprecated for this model."}. Sampling params
    // are removed on the current Claude generation; this was actually in
    // the claude-api skill's own capability table when this file was
    // first written and got missed. Caught via a real failed call, not
    // assumed.
  };
  if (options.jsonSchema) {
    body.output_config = { format: { type: "json_schema", schema: options.jsonSchema } };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      "anthropic-version": ANTHROPIC_API_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Surface Anthropic's own error message (e.g. "`temperature` is
    // deprecated for this model") — found live tonight this was the same
    // discard-the-server's-explanation bug as Places' error handling,
    // just here specifically. "Never log the key" still holds (the key is
    // a REQUEST header, never present in Anthropic's response body), but
    // the response body itself is Anthropic's own safe, secret-free
    // explanation of what was wrong with the request — the thing that
    // actually gets debugging done instead of a bare status code.
    const bodyText = await res.text().catch(() => "");
    let detail = bodyText;
    try {
      detail = JSON.parse(bodyText)?.error?.message ?? bodyText;
    } catch {
      // not JSON — use the raw text as-is
    }
    throw new Error(`Anthropic request failed: ${res.status} ${res.statusText} — ${detail}`);
  }

  const data = await res.json();
  const textBlock = (data?.content ?? []).find((b: { type?: string; text?: string }) => b.type === "text");
  const text: string = textBlock?.text ?? "";
  const inputTokens: number = data?.usage?.input_tokens ?? 0;
  const outputTokens: number = data?.usage?.output_tokens ?? 0;
  const costUsd = computeCostUsd(ANTHROPIC_MODEL, inputTokens, outputTokens);

  const supabase = createAdminClient();
  await supabase.from("anthropic_usage").insert({ model: ANTHROPIC_MODEL, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd });

  return { text, inputTokens, outputTokens, costUsd };
}

export async function setAnthropicSpendCap(capUsd: number): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("anthropic_settings").update({ spend_cap_usd: capUsd }).eq("id", true);
}
