import "server-only";
import type { LeadQualifierProvider, MentorProvider } from "@/lib/ai/providers/types";
import { GeminiLeadQualifier } from "@/lib/ai/providers/gemini-lead-qualifier";
import { GeminiMentorProvider } from "@/lib/ai/providers/gemini-mentor-provider";

/**
 * The only place lib/research/run-job.ts touches for qualification —
 * swapping vendors later means changing this one line, not the job loop.
 */
export function getLeadQualifier(): LeadQualifierProvider {
  return new GeminiLeadQualifier();
}

/** Same reasoning — lib/ai/mentor.ts and mentor-brief.ts call this, never a vendor SDK directly. */
export function getMentorProvider(): MentorProvider {
  return new GeminiMentorProvider();
}
