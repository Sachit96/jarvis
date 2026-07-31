import type { LeadSignals } from "@/lib/research/types";
import type { QualificationResult } from "@/lib/validations/lead-research";

/** Either a real result, or that element's own failure — a batch call never throws away the businesses that DID qualify because one didn't. */
export type LeadQualifyOutcome = { result: QualificationResult; error?: undefined } | { result?: undefined; error: string };

/**
 * Stage 3's only contract. Business logic (lib/research/run-job.ts) calls
 * getLeadQualifier().qualifyLeads(signalsList) and never imports a vendor
 * SDK or model string directly — swapping providers means writing a new
 * class here and changing the one line in index.ts that constructs it.
 *
 * Takes an array (a batch of up to N, or a single-element array for the
 * per-business fallback path) and always returns an array of the SAME
 * length, in the SAME order — every input index gets an outcome, success
 * or failure, never silently dropped.
 */
export interface LeadQualifierProvider {
  qualifyLeads(signalsList: LeadSignals[]): Promise<LeadQualifyOutcome[]>;
}

// ============================================================= AI Mentor

export interface MentorChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface MentorBriefResult {
  markdownBody: string;
  focusAreas: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface LoggedMealArgs {
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/**
 * The Mentor's three call sites (daily/weekly brief, general chat, the
 * nutrition chatbot's one tool) behind a single provider, same reasoning as
 * LeadQualifierProvider above: lib/ai/mentor.ts and mentor-brief.ts call
 * getMentorProvider() and never touch a vendor SDK or model string.
 */
export interface MentorProvider {
  /** Daily brief / weekly review — structured JSON, single-turn, no tools. "fast"/"deep" pick the model tier, not a raw model string — see gemini-mentor-provider.ts. */
  generateBrief(systemPrompt: string, effort: "fast" | "deep"): Promise<MentorBriefResult>;
  /** General mentor chat — plain multi-turn, no tools. */
  chat(systemPrompt: string, history: MentorChatMessage[]): Promise<string>;
  /**
   * Nutrition chat, with the log_nutrition_entry tool available. `executeTool`
   * is supplied by the caller (lib/ai/mentor.ts) so the actual DB write stays
   * out of this interface and out of the Gemini implementation — this method
   * only drives the two-call tool-use protocol and returns the model's final
   * natural-language reply either way.
   */
  nutritionChat(
    systemPrompt: string,
    history: MentorChatMessage[],
    executeTool: (args: LoggedMealArgs) => Promise<string>,
  ): Promise<string>;
}
