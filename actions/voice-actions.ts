"use server";

import { createClient } from "@/lib/supabase/server";
import { runAgentTurn } from "@/lib/ai/agent";
import { getGeneralMentorMessages } from "@/lib/db/queries/mentor";

export interface VoiceReplyResult {
  reply?: string;
  error?: string;
  /** True on a 429 specifically, so the client can speak a short backoff message instead of a generic failure. */
  rateLimited?: boolean;
  /** Tools this turn ran, for the HUD's activity strip. */
  trace?: { name: string; label: string; ok: boolean }[];
  /** Set when a high-risk tool is waiting on a spoken yes. */
  pendingConfirmation?: { toolName: string; summary: string; args: Record<string, unknown> };
}

/**
 * Voice now goes through the same operator as the Mentor chat.
 *
 * It previously called runGeneralMentorChat, which has no tools — so asking
 * by voice and asking by text gave different capabilities from the same
 * assistant. Both now enter runAgentTurn, which means one tool registry, one
 * permission model, and one place where a bug gets fixed.
 *
 * Voice deliberately keeps sharing the mentor conversation thread
 * (context = 'mentor'), as it always has, so a question asked out loud and a
 * follow-up typed into the widget are one conversation.
 *
 * `confirmedCall` arrives only after the spoken confirmation parser returned
 * an unambiguous yes — see lib/voice/confirmation.ts. The model cannot set
 * it, and neither can an ambiguous utterance.
 */
export async function sendVoiceMessageAction(
  content: string,
  confirmedCall?: { toolName: string; args: Record<string, unknown> },
): Promise<VoiceReplyResult> {
  const trimmed = content.trim();
  if (!trimmed) return { error: "Empty message" };

  const supabase = await createClient();
  try {
    const { error: insertErr } = await supabase
      .from("mentor_messages")
      .insert({ role: "user", content: trimmed, context: "mentor" });
    if (insertErr) throw new Error(insertErr.message);

    const history = await getGeneralMentorMessages(supabase);
    const result = await runAgentTurn(
      supabase,
      history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { confirmedCall },
    );

    // A turn awaiting confirmation has not finished, so its text is not
    // persisted — otherwise the thread carries a half-turn that reads as an
    // answer and the follow-up looks like a non sequitur.
    if (!result.pendingConfirmation) {
      const { error: replyErr } = await supabase
        .from("mentor_messages")
        .insert({ role: "assistant", content: result.text, context: "mentor" });
      if (replyErr) throw new Error(replyErr.message);
    }

    return {
      reply: result.text,
      trace: result.trace,
      pendingConfirmation: result.pendingConfirmation,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: message, rateLimited: message.includes("429") };
  }
}
