"use server";

import { revalidatePath } from "next/cache";
import { runAgentTurn } from "@/lib/ai/agent";
import { toClientTrace } from "@/lib/ai/providers/types";
import { toUserFacingError } from "@/lib/ai/user-error";
import { getDailyRecommendation, getGeneralMentorMessages } from "@/lib/db/queries/mentor";
import { createClient } from "@/lib/supabase/server";
import { todayStr } from "@/lib/date";
import { generateDailyBrief, generateWeeklyReview, runGeneralMentorChat } from "@/lib/ai/mentor-brief";

export interface BriefActionResult {
  error?: string;
}

export async function generateDailyBriefAction(): Promise<BriefActionResult> {
  const supabase = await createClient();
  try {
    await generateDailyBrief(supabase);
    revalidatePath("/mentor");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to generate today's brief" };
  }
}

export interface BriefPayload {
  recDate: string;
  markdownBody: string;
  focusAreas: string[];
  strengths: string[];
  weaknesses: string[];
}

/**
 * Generate today's brief and hand it back, rather than only writing it.
 *
 * The console renders the brief as a turn in the conversation, so it needs
 * the content — but the brief is still a stored artifact, not a chat reply:
 * the weekly review and the scheduled job both read
 * `daily_recommendations`. Writing it and returning it keeps one source of
 * truth instead of a second, chat-shaped copy that drifts.
 *
 * Re-runs regenerate. That is the same behaviour the old "Regenerate
 * today's brief" button had, and it is what a user pressing the chip a
 * second time means.
 */
export async function generateBriefForConsoleAction(): Promise<
  { brief: BriefPayload } | { error: string }
> {
  const supabase = await createClient();
  try {
    await generateDailyBrief(supabase);
    const row = await getDailyRecommendation(supabase, todayStr());
    if (!row) return { error: "The brief was generated but could not be read back." };
    revalidatePath("/mentor");
    return {
      brief: {
        recDate: row.rec_date,
        markdownBody: row.markdown_body,
        focusAreas: row.focus_areas ?? [],
        strengths: row.strengths ?? [],
        weaknesses: row.weaknesses ?? [],
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to generate today's brief" };
  }
}

export async function generateWeeklyReviewAction(): Promise<BriefActionResult> {
  const supabase = await createClient();
  try {
    await generateWeeklyReview(supabase);
    revalidatePath("/mentor/weekly-review");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to generate this week's review" };
  }
}

export interface MentorChatResult {
  error?: string;
  reply?: string;
}

export async function sendGeneralMentorMessageAction(content: string): Promise<MentorChatResult> {
  if (!content.trim()) return { error: "Say something first" };
  const supabase = await createClient();
  try {
    const assistantRow = await runGeneralMentorChat(supabase, content.trim());
    revalidatePath("/mentor");
    return { reply: assistantRow.content };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Mentor chat failed" };
  }
}

// ============================================================= Operator chat

export interface OperatorChatResult {
  reply?: string;
  /** Tools that ran this turn, for the UI's activity trace. */
  trace?: { name: string; label: string; ok: boolean }[];
  /** Set when a high-risk tool is waiting on the user's approval. */
  pendingConfirmation?: { toolName: string; summary: string; args: Record<string, unknown> };
  error?: string;
}

/**
 * The tool-enabled Mentor turn.
 *
 * Kept alongside sendGeneralMentorMessageAction rather than replacing it:
 * that action still backs the SMS webhook and the nutrition chat, which have
 * no way to render a confirmation prompt and so must not be handed
 * high-risk tools.
 *
 * `confirmedCall` is what the user approved, replayed with its original
 * arguments. It is only ever supplied by the confirmation UI — the model has
 * no way to set it.
 */
export async function sendOperatorMessageAction(
  content: string,
  confirmedCall?: { toolName: string; args: Record<string, unknown> },
): Promise<OperatorChatResult> {
  if (!content.trim()) return { error: "Say something first" };
  const supabase = await createClient();

  try {
    const { error: insertErr } = await supabase
      .from("mentor_messages")
      .insert({ role: "user", content: content.trim(), context: "mentor" });
    if (insertErr) throw new Error(insertErr.message);

    const history = await getGeneralMentorMessages(supabase);
    const result = await runAgentTurn(
      supabase,
      history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { confirmedCall },
    );

    // A turn that stopped for confirmation has not finished, so its text is
    // not persisted — otherwise the transcript would carry a half-turn that
    // reads as an answer, and the follow-up would look like a non sequitur.
    if (!result.pendingConfirmation) {
      const { error: replyErr } = await supabase
        .from("mentor_messages")
        .insert({ role: "assistant", content: result.text, context: "mentor" });
      if (replyErr) throw new Error(replyErr.message);
    }

    revalidatePath("/mentor");
    return {
      reply: result.text,
      // Mapped, not passed through: the trace carries the arguments each tool
      // was called with, and Next serializes an action's return value straight
      // to the browser. The UI only renders name/label/ok.
      trace: toClientTrace(result.trace),
      pendingConfirmation: result.pendingConfirmation,
    };
  } catch (err) {
    // The chat renders this string as an assistant bubble, so it must read
    // like JARVIS — never a raw Supabase or vendor message.
    return { error: toUserFacingError(err, "operator-chat").message };
  }
}
