"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
