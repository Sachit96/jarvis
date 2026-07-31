"use server";

import { createClient } from "@/lib/supabase/server";
import { runGeneralMentorChat } from "@/lib/ai/mentor-brief";

export interface VoiceReplyResult {
  reply?: string;
  error?: string;
  /** True on a 429 specifically, so the client can speak a short backoff message instead of a generic failure. */
  rateLimited?: boolean;
}

/**
 * Voice mode deliberately shares the same conversation thread as the text
 * "Ask your Mentor" widget (context = 'mentor', see runGeneralMentorChat) —
 * per the work order's own scope boundary, voice gets the existing chat
 * history, not a separate memory system.
 */
export async function sendVoiceMessageAction(content: string): Promise<VoiceReplyResult> {
  const trimmed = content.trim();
  if (!trimmed) return { error: "Empty message" };

  const supabase = await createClient();
  try {
    const row = await runGeneralMentorChat(supabase, trimmed);
    return { reply: row.content };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: message, rateLimited: message.includes("429") };
  }
}
