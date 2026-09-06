import { createAdminClient } from "../admin-client";
import { isMissingRelation } from "../../../../lib/db/missing-relation";

// Deliberate duplicate of lib/ai/providers/anthropic-client.ts — see
// _shared/admin-client.ts's comment for why. Only the guard line and the
// two import paths (createAdminClient from the _shared duplicate,
// isMissingRelation from the real, unguarded lib/db/missing-relation.ts)
// differ from the original.
//
// Anthropic — the only paid path in this app. No ongoing free tier (a
// one-time trial credit, then pay-per-token), unlike every Gemini tier
// used elsewhere here. Model ID and pricing verified against current
// Anthropic documentation before the original was written, not recalled
// from training data.
export const ANTHROPIC_MODEL = "claude-sonnet-5";
export const ANTHROPIC_API_VERSION = "2023-06-01";
export const DEFAULT_SPEND_CAP_USD = 3.0;

export const ANTHROPIC_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-opus-5": { inputPerMTok: 5.0, outputPerMTok: 25.0 },
  "claude-sonnet-5": { inputPerMTok: 2.0, outputPerMTok: 10.0 },
  "claude-haiku-4-5": { inputPerMTok: 1.0, outputPerMTok: 5.0 },
};

export function computeCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = ANTHROPIC_PRICING[model];
  if (!rate) return 0;
  return (inputTokens / 1_000_000) * rate.inputPerMTok + (outputTokens / 1_000_000) * rate.outputPerMTok;
}

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

async function isSpendTrackingAvailable(): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("anthropic_usage").select("id").limit(1);
  return !isMissingRelation(error);
}

export async function isAnthropicAvailable(): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  if (!(await isSpendTrackingAvailable())) return false;
  const [cap, spent] = await Promise.all([getAnthropicSpendCap(), getAnthropicSpendToDate()]);
  return !isOverSpendCap(spent, cap);
}

export interface AnthropicCallOptions {
  system: string;
  userContent: string;
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
}

export interface AnthropicCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export async function callAnthropic(options: AnthropicCallOptions): Promise<AnthropicCallResult> {
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
