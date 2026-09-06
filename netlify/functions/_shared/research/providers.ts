import type { LeadQualifierProvider } from "../../../../lib/ai/providers/types";
import { GeminiLeadQualifier } from "./gemini-lead-qualifier";
import { AnthropicLeadQualifier } from "./anthropic-lead-qualifier";
import { isAnthropicAvailable } from "./anthropic-client";

// Deliberate, TRIMMED duplicate of lib/ai/providers.ts (the factory) — see
// _shared/admin-client.ts's comment for why. Trimmed because run-job.ts
// only ever calls getLeadQualifier(); the real file also exports
// getMentorProvider()/GeminiMentorProvider for the AI Mentor's chat/brief
// call sites, which this pipeline never touches — pulling that chain in
// here just to mirror the original file byte-for-byte would duplicate
// code with no caller, so it's deliberately left out. If a future change
// makes this pipeline need the mentor provider too, add it back here the
// same way, not by importing the original.
//
// The only place this pipeline touches for qualification — swapping
// vendors later means changing this one function, not the job loop. Picks
// Anthropic only when ANTHROPIC_API_KEY is set AND lifetime spend is still
// under its configurable cap; any other case falls back to Gemini. Anthropic
// not being configured must never be a reason lead qualification fails.
export async function getLeadQualifier(): Promise<LeadQualifierProvider> {
  try {
    if (await isAnthropicAvailable()) return new AnthropicLeadQualifier();
  } catch {
    // Fall through to Gemini — a broken availability check is not a reason to fail qualification.
  }
  return new GeminiLeadQualifier();
}
