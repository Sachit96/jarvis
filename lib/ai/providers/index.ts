import "server-only";
import type { LeadQualifierProvider, MentorProvider } from "@/lib/ai/providers/types";
import { GeminiLeadQualifier } from "@/lib/ai/providers/gemini-lead-qualifier";
import { GeminiMentorProvider } from "@/lib/ai/providers/gemini-mentor-provider";
import { AnthropicLeadQualifier } from "@/lib/ai/providers/anthropic-lead-qualifier";
import { isAnthropicAvailable } from "@/lib/ai/providers/anthropic-client";

/**
 * The only place lib/research/run-job.ts touches for qualification —
 * swapping vendors later means changing this one function, not the job
 * loop. Async now (Work Order 6): picks Anthropic only when
 * ANTHROPIC_API_KEY is set AND lifetime spend is still under its
 * configurable cap (isAnthropicAvailable checks both in one query round
 * trip); any other case — no key, cap reached, or the availability check
 * itself throwing — falls back to the existing Gemini path. Anthropic not
 * being configured must never be a reason lead qualification fails.
 */
export async function getLeadQualifier(): Promise<LeadQualifierProvider> {
  try {
    if (await isAnthropicAvailable()) return new AnthropicLeadQualifier();
  } catch {
    // Fall through to Gemini — a broken availability check is not a reason to fail qualification.
  }
  return new GeminiLeadQualifier();
}

/** Same reasoning — lib/ai/mentor.ts and mentor-brief.ts call this, never a vendor SDK directly. Anthropic isn't wired in here — Work Order 6 scoped it to the lead qualifier only. */
export function getMentorProvider(): MentorProvider {
  return new GeminiMentorProvider();
}
