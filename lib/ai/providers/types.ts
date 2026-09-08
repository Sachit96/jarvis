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


// ============================================================= Agent loop

/** One tool call the model asked for. */
export interface AgentToolCall {
  name: string;
  args: Record<string, unknown>;
}

/** What the caller did with a tool call, and what should happen next. */
export interface AgentToolOutcome {
  /** Sent back to the model as the function response. */
  response: Record<string, unknown>;
  /** Human-readable line for the UI trace, e.g. "Checked your tasks". */
  label: string;
  /** True when the call succeeded — drives the trace's tick/cross only. */
  ok: boolean;
  /**
   * Set to stop the loop immediately and hand control back to the user.
   * Used for confirmation: the model must not keep reasoning as though a
   * high-risk action had already run.
   */
  halt?: { reason: "confirmation_required"; toolName: string; summary: string; args: Record<string, unknown> };
}

export interface AgentTraceEntry {
  name: string;
  label: string;
  ok: boolean;
  /**
   * The arguments the model actually passed, after validation.
   *
   * Server-side only. Next's Server Actions guide is explicit that action
   * return values are serialized to the client and should be shaped to what
   * the UI renders — so the two operator actions map this away before
   * returning, and only the live QA harness (which calls runAgentTurn
   * directly) ever reads it. It exists so a test matrix can report what was
   * called WITH, not merely what was called.
   */
  args: Record<string, unknown>;
}

/** The subset of a trace entry that is safe to serialize to the browser. */
export type ClientTraceEntry = Pick<AgentTraceEntry, "name" | "label" | "ok">;

export function toClientTrace(trace: AgentTraceEntry[]): ClientTraceEntry[] {
  return trace.map(({ name, label, ok }) => ({ name, label, ok }));
}

export interface AgentChatResult {
  text: string;
  /** Every tool the model ran this turn, in order. */
  trace: AgentTraceEntry[];
  pendingConfirmation?: { toolName: string; summary: string; args: Record<string, unknown> };
}

export interface AgentChatOptions {
  systemPrompt: string;
  history: MentorChatMessage[];
  tools: { name: string; description: string; parameters: Record<string, unknown> }[];
  execute: (call: AgentToolCall) => Promise<AgentToolOutcome>;
  /**
   * Whether a tool is safe to run concurrently with its siblings in the same
   * round. The provider cannot answer this — risk lives in the registry — so
   * the caller supplies the predicate. Defaults to false, i.e. sequential,
   * because that is the behaviour that is always correct.
   */
  parallelSafe?: (name: string) => boolean;
  /**
   * Ceiling on model round trips. Bounds both cost and latency, and stops a
   * model that keeps re-calling the same tool from looping forever.
   */
  maxRounds?: number;
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
  /**
   * The general operator loop: many tools, several rounds, and the
   * execution decision delegated entirely to the caller.
   *
   * Generalises nutritionChat, which hardcodes one tool and exactly one
   * round trip. Same principle as that method — the provider drives the
   * wire protocol and never touches the database — but the caller now
   * supplies the tool list and an execute callback that can also halt the
   * loop (for a confirmation prompt) rather than only returning a string.
   */
  agentChat(options: AgentChatOptions): Promise<AgentChatResult>;
}
