import "server-only";
import type Groq from "groq-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getGroqClient, MENTOR_MODEL } from "@/lib/ai/groq";
import {
  getNutritionTargets,
  getNutritionLogsForDate,
  computeMacroTotals,
  getWorkouts,
} from "@/lib/db/queries/health";

type Client = SupabaseClient<Database>;

const LOG_NUTRITION_TOOL: Groq.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "log_nutrition_entry",
    description:
      "Log a meal or food the user describes into their nutrition diary, with your best estimate of its macros.",
    parameters: {
      type: "object",
      properties: {
        meal_type: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
        description: { type: "string", description: "Short description of what was eaten" },
        calories: { type: "number" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fat_g: { type: "number" },
      },
      required: ["meal_type", "description", "calories", "protein_g", "carbs_g", "fat_g"],
    },
  },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function buildSystemPrompt(supabase: Client) {
  const today = todayStr();
  const [targets, todayLogs, recentWorkouts] = await Promise.all([
    getNutritionTargets(supabase),
    getNutritionLogsForDate(supabase, today),
    getWorkouts(supabase),
  ]);
  const totals = computeMacroTotals(todayLogs);

  const context = {
    today,
    nutritionTargets: targets
      ? {
          calories: targets.target_calories,
          protein_g: targets.target_protein_g,
          carbs_g: targets.target_carbs_g,
          fat_g: targets.target_fat_g,
          water_ml: targets.target_water_ml,
        }
      : "not set yet",
    nutritionSoFarToday: totals,
    recentWorkouts: recentWorkouts.slice(0, 5).map((w) => ({
      session_label: w.session_label,
      started_at: w.started_at,
      completed: w.completed,
    })),
  };

  return [
    "You are JARVIS's Health & Nutrition Mentor, a knowledgeable and encouraging coach embedded in the user's personal dashboard.",
    "You can: (1) parse meal descriptions into estimated macros and log them via the log_nutrition_entry tool, (2) evaluate training routines the user describes, (3) answer general health/nutrition questions.",
    "When the user describes something they ate or are about to eat, estimate its macros as best you can and call log_nutrition_entry — don't ask clarifying questions unless the description is too vague to estimate at all.",
    "Keep replies concise (2-4 sentences) unless the user asks for depth.",
    "The context below is internal data with snake_case/camelCase keys (like protein_g, nutritionSoFarToday) — never quote those key names back to the user. Translate every number into plain, natural language (e.g. say \"your protein today\", not the raw key).",
    `The user's current context as JSON: ${JSON.stringify(context)}`,
  ].join("\n\n");
}

export async function runMentorChat(supabase: Client, userContent: string) {
  const client = getGroqClient();
  if (!client) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const { error: insertUserErr } = await supabase
    .from("mentor_messages")
    .insert({ role: "user", content: userContent, context: "nutrition" });
  if (insertUserErr) throw new Error(insertUserErr.message);

  const { data: history, error: historyErr } = await supabase
    .from("mentor_messages")
    .select("role, content")
    .eq("context", "nutrition")
    .order("created_at", { ascending: false })
    .limit(20);
  if (historyErr) throw new Error(historyErr.message);

  const systemPrompt = await buildSystemPrompt(supabase);

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.reverse().map(
      (m): Groq.Chat.ChatCompletionMessageParam => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }),
    ),
  ];

  const first = await client.chat.completions.create({
    model: MENTOR_MODEL,
    messages,
    tools: [LOG_NUTRITION_TOOL],
  });

  const firstMessage = first.choices[0].message;
  let finalContent = firstMessage.content ?? "";

  if (firstMessage.tool_calls && firstMessage.tool_calls.length > 0) {
    const toolReplies: Groq.Chat.ChatCompletionMessageParam[] = [];
    for (const call of firstMessage.tool_calls) {
      if (call.function.name !== "log_nutrition_entry") continue;
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        toolReplies.push({ role: "tool", tool_call_id: call.id, content: "Could not parse arguments." });
        continue;
      }
      const { error: logErr } = await supabase.from("nutrition_logs").insert({
        meal_type: String(args.meal_type),
        description: String(args.description),
        calories: Math.round(Number(args.calories) || 0),
        protein_g: Number(args.protein_g) || 0,
        carbs_g: Number(args.carbs_g) || 0,
        fat_g: Number(args.fat_g) || 0,
        source: "chatbot",
        logged_at: todayStr(),
      });
      toolReplies.push({
        role: "tool",
        tool_call_id: call.id,
        content: logErr ? `Failed to log: ${logErr.message}` : "Logged successfully.",
      });
    }

    const second = await client.chat.completions.create({
      model: MENTOR_MODEL,
      messages: [
        ...messages,
        { role: "assistant", content: firstMessage.content ?? "", tool_calls: firstMessage.tool_calls },
        ...toolReplies,
      ],
    });
    finalContent = second.choices[0].message.content ?? "Logged it.";
  }

  const { data: assistantRow, error: insertAssistantErr } = await supabase
    .from("mentor_messages")
    .insert({ role: "assistant", content: finalContent, context: "nutrition" })
    .select()
    .single();
  if (insertAssistantErr) throw new Error(insertAssistantErr.message);

  return assistantRow;
}
