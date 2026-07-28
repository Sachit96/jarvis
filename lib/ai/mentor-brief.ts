import "server-only";
import type Groq from "groq-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getGroqClient, MENTOR_MODEL } from "@/lib/ai/groq";
import { buildMentorContext } from "@/lib/ai/context-builder";

type Client = SupabaseClient<Database>;

interface BriefResult {
  markdownBody: string;
  focusAreas: string[];
  strengths: string[];
  weaknesses: string[];
}

function parseBrief(raw: string): BriefResult {
  try {
    const parsed = JSON.parse(raw);
    const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    return {
      markdownBody: typeof parsed.markdownBody === "string" ? parsed.markdownBody : raw,
      focusAreas: strings(parsed.focusAreas),
      strengths: strings(parsed.strengths),
      weaknesses: strings(parsed.weaknesses),
    };
  } catch {
    return { markdownBody: raw, focusAreas: [], strengths: [], weaknesses: [] };
  }
}

const JSON_INSTRUCTION =
  'Respond with ONLY a JSON object matching this exact shape, no prose outside it: {"markdownBody": string, "focusAreas": string[], "strengths": string[], "weaknesses": string[]}.';

const VOICE_GUARDRAIL =
  "The context below is internal data with camelCase keys (like monthlyIncome, openPipelineDealsCount, dailyRoutineToday) — never quote those key names, or any other variable/field name, back to the user. Translate every number into plain, natural language a calm human coach would actually say (e.g. say \"your income this month\" or \"open deals in your pipeline\", not the raw key). Keep it concise — a clear short sentence beats a long explained one.";

const DAILY_INSTRUCTIONS = `Write today's brief as markdown with these headers: ## Focus Today, ## Wins, ## Watch-outs. Be specific and reference the actual numbers in the user's context. Keep markdownBody under 200 words.`;

const WEEKLY_INSTRUCTIONS = `Write this week's review as markdown with these headers: ## Summary, ## Strengths, ## Weaknesses, ## Next Week's Focus. Be specific and reference the actual numbers/trends in the user's context. Keep markdownBody under 350 words.`;

/** Groq's JSON mode support can vary by model — fall back to a plain completion if the param itself is rejected. */
async function callMentorJson(client: Groq, systemPrompt: string): Promise<BriefResult> {
  try {
    const res = await client.chat.completions.create({
      model: MENTOR_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate it now." },
      ],
      response_format: { type: "json_object" },
    });
    return parseBrief(res.choices[0]?.message.content ?? "{}");
  } catch {
    const res = await client.chat.completions.create({
      model: MENTOR_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate it now." },
      ],
    });
    return parseBrief(res.choices[0]?.message.content ?? "{}");
  }
}

export async function generateDailyBrief(supabase: Client, userId: string) {
  const client = getGroqClient();
  if (!client) throw new Error("GROQ_API_KEY is not configured");
  const context = await buildMentorContext(supabase);

  const systemPrompt = [
    "You are JARVIS, a sharp, encouraging personal AI mentor reviewing the user's life/finance/health/business dashboard.",
    DAILY_INSTRUCTIONS,
    VOICE_GUARDRAIL,
    JSON_INSTRUCTION,
    `The user's current context as JSON: ${JSON.stringify(context)}`,
  ].join("\n\n");

  const brief = await callMentorJson(client, systemPrompt);
  const recDate = context.today;

  const { error } = await supabase.from("daily_recommendations").upsert(
    {
      user_id: userId,
      rec_date: recDate,
      markdown_body: brief.markdownBody,
      focus_areas: brief.focusAreas,
      strengths: brief.strengths,
      weaknesses: brief.weaknesses,
      model_used: MENTOR_MODEL,
    },
    { onConflict: "user_id,rec_date" },
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

export async function generateWeeklyReview(supabase: Client, userId: string) {
  const client = getGroqClient();
  if (!client) throw new Error("GROQ_API_KEY is not configured");
  const context = await buildMentorContext(supabase);

  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const toStr = (d: Date) => d.toISOString().slice(0, 10);

  const systemPrompt = [
    "You are JARVIS, a sharp, encouraging personal AI mentor writing the user's weekly review across life/finance/health/business.",
    WEEKLY_INSTRUCTIONS,
    VOICE_GUARDRAIL,
    JSON_INSTRUCTION,
    `The user's current context as JSON: ${JSON.stringify(context)}`,
  ].join("\n\n");

  const brief = await callMentorJson(client, systemPrompt);
  const weekStartDate = toStr(start);
  const weekEndDate = toStr(end);

  const { error } = await supabase.from("weekly_reviews").upsert(
    {
      user_id: userId,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
      markdown_body: brief.markdownBody,
      focus_areas: brief.focusAreas,
      strengths: brief.strengths,
      weaknesses: brief.weaknesses,
      model_used: MENTOR_MODEL,
    },
    { onConflict: "user_id,week_start_date" },
  );
  if (error) throw new Error(error.message);

  return { ...brief, weekStartDate, weekEndDate };
}

export async function runGeneralMentorChat(supabase: Client, userId: string, userContent: string) {
  const client = getGroqClient();
  if (!client) throw new Error("GROQ_API_KEY is not configured");

  const { error: insertUserErr } = await supabase
    .from("mentor_messages")
    .insert({ user_id: userId, role: "user", content: userContent, context: "mentor" });
  if (insertUserErr) throw new Error(insertUserErr.message);

  const { data: history, error: historyErr } = await supabase
    .from("mentor_messages")
    .select("role, content")
    .eq("context", "mentor")
    .order("created_at", { ascending: false })
    .limit(20);
  if (historyErr) throw new Error(historyErr.message);

  const context = await buildMentorContext(supabase);
  const systemPrompt = [
    "You are JARVIS, the user's personal AI mentor with visibility into their tasks, habits, finances, health, and business pipeline.",
    "Answer questions, give advice, and reference specific numbers from their context when relevant. Keep replies concise (2-5 sentences) unless asked for depth.",
    VOICE_GUARDRAIL,
    `The user's current context as JSON: ${JSON.stringify(context)}`,
  ].join("\n\n");

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.reverse().map(
      (m): Groq.Chat.ChatCompletionMessageParam => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }),
    ),
  ];

  const res = await client.chat.completions.create({ model: MENTOR_MODEL, messages });
  const replyContent = res.choices[0]?.message.content ?? "…";

  const { data: assistantRow, error: insertAssistantErr } = await supabase
    .from("mentor_messages")
    .insert({ user_id: userId, role: "assistant", content: replyContent, context: "mentor" })
    .select()
    .single();
  if (insertAssistantErr) throw new Error(insertAssistantErr.message);

  return assistantRow;
}
