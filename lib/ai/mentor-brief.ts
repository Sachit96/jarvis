import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getMentorProvider } from "@/lib/ai/providers";
import type { MentorChatMessage } from "@/lib/ai/providers/types";
import { buildMentorContext } from "@/lib/ai/context-builder";
import { buildPersonaPrefix } from "@/lib/ai/persona";

type Client = SupabaseClient<Database>;

const JSON_INSTRUCTION =
  'Respond with ONLY a JSON object matching this exact shape, no prose outside it: {"markdownBody": string, "focusAreas": string[], "strengths": string[], "weaknesses": string[]}.';

const VOICE_GUARDRAIL =
  "The context below is internal data with camelCase keys (like monthlyIncome, openPipelineDealsCount, dailyRoutineToday) — never quote those key names, or any other variable/field name, back to the user. Translate every number into plain, natural language a calm human coach would actually say (e.g. say \"your income this month\" or \"open deals in your pipeline\", not the raw key). Keep it concise — a clear short sentence beats a long explained one.";

const DAILY_INSTRUCTIONS = `Write today's brief as markdown with these headers: ## Focus Today, ## Wins, ## Watch-outs. Be specific and reference the actual numbers in the user's context. Keep markdownBody under 200 words.`;

const WEEKLY_INSTRUCTIONS = `Write this week's review as markdown with these headers: ## Summary, ## Strengths, ## Weaknesses, ## Next Week's Focus. Be specific and reference the actual numbers/trends in the user's context. Keep markdownBody under 350 words.`;

/**
 * Follow-up watchdog (Work Order B3) — context.followUps is mechanically
 * computed (a SQL-shaped query in lib/db/queries/business.ts, not a model
 * call); this is the only piece that needs the LLM at all, and it rides
 * along on whichever of the three calls below is already happening rather
 * than adding a new one.
 */
const FOLLOWUP_NUDGE = `If context.followUps.staleDeals or staleContacts is non-empty, name the most important one or two specifically (e.g. "Bianchi Roofing hasn't moved in 9 days") — surfacing exactly this kind of thing unprompted is the whole point of tracking it.`;

export async function generateDailyBrief(supabase: Client) {
  const provider = getMentorProvider();
  const [context, persona] = await Promise.all([buildMentorContext(supabase), buildPersonaPrefix(supabase)]);

  const systemPrompt = [
    persona,
    DAILY_INSTRUCTIONS,
    FOLLOWUP_NUDGE,
    VOICE_GUARDRAIL,
    JSON_INSTRUCTION,
    `The user's current context as JSON: ${JSON.stringify(context)}`,
  ].join("\n\n");

  const brief = await provider.generateBrief(systemPrompt, "fast");
  const recDate = context.today;

  const { error } = await supabase.from("daily_recommendations").upsert(
    {
      rec_date: recDate,
      markdown_body: brief.markdownBody,
      focus_areas: brief.focusAreas,
      strengths: brief.strengths,
      weaknesses: brief.weaknesses,
      model_used: "gemini (fast)",
    },
    { onConflict: "rec_date" },
  );
  if (error) throw new Error(error.message);

  return { ...brief, recDate };
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as the start of the week
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function generateWeeklyReview(supabase: Client) {
  const provider = getMentorProvider();
  const [context, persona] = await Promise.all([buildMentorContext(supabase), buildPersonaPrefix(supabase)]);

  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const toStr = (d: Date) => d.toISOString().slice(0, 10);

  const systemPrompt = [
    persona,
    WEEKLY_INSTRUCTIONS,
    FOLLOWUP_NUDGE,
    VOICE_GUARDRAIL,
    JSON_INSTRUCTION,
    `The user's current context as JSON: ${JSON.stringify(context)}`,
  ].join("\n\n");

  // "deep" — the one weekly, once-a-week synthesis job, worth the heavier
  // model the daily brief and both chats don't need. See
  // gemini-mentor-provider.ts for which model that maps to and why.
  const brief = await provider.generateBrief(systemPrompt, "deep");
  const weekStartDate = toStr(start);
  const weekEndDate = toStr(end);

  const { error } = await supabase.from("weekly_reviews").upsert(
    {
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
      markdown_body: brief.markdownBody,
      focus_areas: brief.focusAreas,
      strengths: brief.strengths,
      weaknesses: brief.weaknesses,
      model_used: "gemini (deep)",
    },
    { onConflict: "week_start_date" },
  );
  if (error) throw new Error(error.message);

  return { ...brief, weekStartDate, weekEndDate };
}

export async function runGeneralMentorChat(supabase: Client, userContent: string) {
  const provider = getMentorProvider();

  const { error: insertUserErr } = await supabase
    .from("mentor_messages")
    .insert({ role: "user", content: userContent, context: "mentor" });
  if (insertUserErr) throw new Error(insertUserErr.message);

  const { data: history, error: historyErr } = await supabase
    .from("mentor_messages")
    .select("role, content")
    .eq("context", "mentor")
    .order("created_at", { ascending: false })
    .limit(20);
  if (historyErr) throw new Error(historyErr.message);

  const [context, persona] = await Promise.all([buildMentorContext(supabase), buildPersonaPrefix(supabase)]);
  const systemPrompt = [
    persona,
    "Answer questions, give advice, and reference specific numbers from their context when relevant. Keep replies concise (2-5 sentences) unless asked for depth.",
    FOLLOWUP_NUDGE,
    VOICE_GUARDRAIL,
    `The user's current context as JSON: ${JSON.stringify(context)}`,
  ].join("\n\n");

  const messages: MentorChatMessage[] = history
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const replyContent = await provider.chat(systemPrompt, messages);

  const { data: assistantRow, error: insertAssistantErr } = await supabase
    .from("mentor_messages")
    .insert({ role: "assistant", content: replyContent, context: "mentor" })
    .select()
    .single();
  if (insertAssistantErr) throw new Error(insertAssistantErr.message);

  return assistantRow;
}
