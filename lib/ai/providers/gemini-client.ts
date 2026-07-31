import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { incrementGeminiUsage } from "@/lib/db/queries/gemini-usage";

// Shared low-level helper behind every Gemini call in this app (mentor
// chat, daily brief, weekly review, nutrition chat, voice mode, and lead
// qualification). Deliberately still targets the classic generateContent
// REST endpoint, not the newer "Interactions API" Google now recommends as
// of 2026 — generateContent is explicitly documented as still fully
// supported ("legacy" means steered-away-from, not deprecated), and it's
// the already-verified-working shape everything here shipped on. Worth a
// deliberate follow-up migration, not a partial switch bolted onto this one.

/**
 * Ground-truth AI Studio limits for this project (checked directly, not
 * assumed): every full Flash/Pro model here is 5 RPM / 20 RPD — unusable
 * for an app with five features sharing one key. gemini-3.5-flash-lite is
 * 15 RPM / 500 RPD, confirmed to support responseSchema structured output
 * via its dedicated model page (Structured outputs: Supported). One
 * constant, every caller imports it — nothing hardcodes a model string.
 *
 * Eventual upgrade path for voice specifically, not wired up now: Gemini 3
 * Flash Live and 2.5 Flash Native Audio Dialog have UNLIMITED RPM/RPD on
 * this project (token-capped only) via the Live API — a genuinely
 * different, streaming/duplex API shape from generateContent, so adopting
 * it is a real rewrite of the voice call path, not a constant swap.
 */
export const GEMINI_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_DAILY_LIMIT = 500;

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const JITTER_FRACTION = 0.25;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withJitter(ms: number) {
  const jitter = ms * JITTER_FRACTION * (Math.random() * 2 - 1); // ±25%
  return Math.max(0, Math.round(ms + jitter));
}

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  // Gemini's schema dialect uses uppercase OpenAPI-style type names
  // ("OBJECT", "STRING", ...), same as responseSchema below.
  parameters: Record<string, unknown>;
}

export interface GeminiCallOptions {
  systemInstruction: string;
  contents: GeminiContent[];
  /** JSON mode — mutually exclusive with tools in practice (we never need both at once). */
  responseSchema?: Record<string, unknown>;
  tools?: GeminiFunctionDeclaration[];
  temperature?: number;
}

export interface GeminiCallResult {
  text: string | null;
  functionCalls: { name: string; args: Record<string, unknown> }[];
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

async function requestOnce(body: Record<string, unknown>): Promise<Response> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": getApiKey() },
    body: JSON.stringify(body),
  });
}

export async function callGemini(options: GeminiCallOptions): Promise<GeminiCallResult> {
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

  const supabase = createAdminClient();
  let lastError: Error | null = null;

  // Initial attempt + up to RETRY_DELAYS_MS.length retries on 429, waiting
  // 1s/2s/4s/8s (±25% jitter) between them — 5 attempts total worst case.
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    // Checked before every actual HTTP attempt, including retries — a
    // retry storm against an already-exhausted quota is exactly the
    // "silently exhaust the shared budget" failure mode this guards
    // against, so it's cheaper to refuse locally than let Google 429 us
    // five more times for the same logical request.
    const count = await incrementGeminiUsage(supabase);
    if (count > GEMINI_DAILY_LIMIT) {
      throw new Error(`Daily Gemini budget exhausted (${GEMINI_DAILY_LIMIT} requests/day across all features) — resets at midnight UTC.`);
    }

    const res = await requestOnce(body);
    if (res.ok) {
      const data = await res.json();
      const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
      if (parts.length === 0) {
        throw new Error(`Gemini response had no content parts (finishReason: ${data?.candidates?.[0]?.finishReason ?? "unknown"})`);
      }
      const textParts = parts.filter((p) => typeof p.text === "string").map((p) => p.text as string);
      const functionCalls = parts
        .filter((p): p is GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> } => !!p.functionCall)
        .map((p) => p.functionCall);
      return { text: textParts.length > 0 ? textParts.join("") : null, functionCalls };
    }

    // Never log the response body (can echo request content on some error
    // paths) or the key itself.
    lastError = new Error(`Gemini request failed: ${res.status} ${res.statusText}`);
    if (res.status !== 429 || attempt === RETRY_DELAYS_MS.length) break;
    await sleep(withJitter(RETRY_DELAYS_MS[attempt]));
  }

  throw lastError ?? new Error("Gemini request failed");
}
