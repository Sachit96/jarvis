import { createAdminClient } from "../admin-client";
import { incrementGeminiUsage } from "../../../../lib/db/queries/gemini-usage";

// Deliberate duplicate of lib/ai/providers/gemini-client.ts — see
// _shared/admin-client.ts's comment for why (that file's own
// `import "server-only"` crashes at module load under Netlify's function
// bundler). lib/db/queries/gemini-usage.ts carries no such guard (only
// `import type` "@/..." references, erased at compile time, plus
// isMissingRelation/todayStr), so it's imported directly rather than
// duplicated. Everything below is unchanged logic from the original.
//
// Shared low-level helper behind every Gemini call in this app (mentor
// chat, daily brief, weekly review, nutrition chat, voice mode, and lead
// qualification). Deliberately still targets the classic generateContent
// REST endpoint, not the newer "Interactions API" Google now recommends as
// of 2026 — generateContent is explicitly documented as still fully
// supported ("legacy" means steered-away-from, not deprecated), and it's
// the already-verified-working shape everything here shipped on. Worth a
// deliberate follow-up migration, not a partial switch bolted onto this one.

/**
 * Two-tier capability-based routing. Ground-truth limits and behavior
 * verified live against the real API with this project's key before this
 * was built (not read off AI Studio's rate-limit table alone):
 *
 * - "structured" (gemini-3.5-flash-lite): 500 RPD / 15 RPM / 250K TPM. True
 *   constrained-decoding responseSchema and function calling. Reserved for
 *   calls that genuinely need either, because Gemma's structured output is
 *   NOT reliably usable for complex shapes — verified 3/3 failures on a
 *   nested array-of-objects-with-enums schema (a stray trailing markdown
 *   fence after otherwise-correct JSON; content was right, wrapping wasn't).
 * - "high_volume" (gemma-4-31b-it): 14,400 RPD / 30 RPM / 16K TPM — ~29x
 *   the daily requests of the structured tier, at zero additional cost.
 *   Verified live: responseSchema IS reliable here for FLAT schemas (no
 *   nesting, no enums — confirmed clean 3/3 on the daily-brief shape).
 *   Function calling works, both call directions (functionCall out,
 *   functionResponse back in), verified against the real nutrition-logging
 *   round trip. systemInstruction is honored correctly. Real caveats:
 *   (1) every call does mandatory hidden "thinking" — 74-367 tokens
 *   observed even on trivial prompts, and it cannot be disabled
 *   (thinkingConfig.thinkingBudget was explicitly rejected by the API:
 *   "Thinking budget is not supported for this model") — those tokens
 *   count toward the 16K TPM ceiling with no visible value; (2) the
 *   response can include "thought" parts alongside the real answer, which
 *   must be filtered out before use (see the `!p.thought` filter below —
 *   without it, internal reasoning text leaks into what the user sees);
 *   (3) the free-tier endpoint returned real 503 "high demand" responses
 *   twice during verification — treated as retryable, same as 429.
 *
 * Every call site picks its tier by capability need alone — see the
 * routing comment at each call site in gemini-mentor-provider.ts and
 * gemini-lead-qualifier.ts. There is no automatic cross-tier fallback:
 * every current call site's tier is fixed by what it actually needs, so a
 * tier's budget exhaustion is a hard stop with a clear message, not a
 * silent downgrade to a tier that can't reliably serve that call.
 */
export type GeminiTier = "structured" | "high_volume";

export const TIER_MODEL: Record<GeminiTier, string> = {
  structured: "gemini-3.5-flash-lite",
  high_volume: "gemma-4-31b-it",
};

export const TIER_DAILY_LIMIT: Record<GeminiTier, number> = {
  structured: 500,
  high_volume: 14400,
};

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const JITTER_FRACTION = 0.25;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function withJitter(ms: number) {
  const jitter = ms * JITTER_FRACTION * (Math.random() * 2 - 1); // ±25%
  return Math.max(0, Math.round(ms + jitter));
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503;
}

export function isOverDailyLimit(count: number, dailyLimit: number): boolean {
  return count > dailyLimit;
}

export interface GeminiPart {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GeminiCallOptions {
  tier: GeminiTier;
  systemInstruction: string;
  contents: GeminiContent[];
  responseSchema?: Record<string, unknown>;
  tools?: GeminiFunctionDeclaration[];
  enableSearchGrounding?: boolean;
  temperature?: number;
}

export interface GeminiCallResult {
  text: string | null;
  functionCalls: { name: string; args: Record<string, unknown> }[];
  grounded: boolean;
}

export function stripMarkdownFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

async function requestOnce(model: string, body: Record<string, unknown>): Promise<Response> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": getApiKey() },
    body: JSON.stringify(body),
  });
}

export async function callGemini(options: GeminiCallOptions): Promise<GeminiCallResult> {
  const model = TIER_MODEL[options.tier];
  const dailyLimit = TIER_DAILY_LIMIT[options.tier];

  const generationConfig: Record<string, unknown> = { temperature: options.temperature ?? 0.5 };
  if (options.responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = options.responseSchema;
  }
  const body: Record<string, unknown> = {
    contents: options.contents,
    systemInstruction: { parts: [{ text: options.systemInstruction }] },
    generationConfig,
  };
  if (options.tools) body.tools = [{ functionDeclarations: options.tools }];
  if (options.enableSearchGrounding) body.tools = [{ google_search: {} }];

  const supabase = createAdminClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const count = await incrementGeminiUsage(supabase, model);
    if (isOverDailyLimit(count, dailyLimit)) {
      throw new Error(`${model} daily budget exhausted (${dailyLimit} requests/day) — resets at midnight UTC.`);
    }

    const res = await requestOnce(model, body);
    if (res.ok) {
      const data = await res.json();
      const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
      if (parts.length === 0) {
        throw new Error(`Gemini response had no content parts (finishReason: ${data?.candidates?.[0]?.finishReason ?? "unknown"})`);
      }
      const textParts = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text as string);
      const functionCalls = parts
        .filter((p): p is GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> } => !!p.functionCall)
        .map((p) => p.functionCall);
      const groundingChunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const grounded = Array.isArray(groundingChunks) && groundingChunks.length > 0;
      return { text: textParts.length > 0 ? textParts.join("") : null, functionCalls, grounded };
    }

    lastError = new Error(`Gemini request failed: ${res.status} ${res.statusText}`);
    if (!isRetryableStatus(res.status) || attempt === RETRY_DELAYS_MS.length) break;
    await sleep(withJitter(RETRY_DELAYS_MS[attempt]));
  }

  throw lastError ?? new Error("Gemini request failed");
}
