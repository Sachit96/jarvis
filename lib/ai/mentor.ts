import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getMentorProvider } from "@/lib/ai/providers";
import type { LoggedMealArgs, MentorChatMessage } from "@/lib/ai/providers/types";
import { buildPersonaPrefix } from "@/lib/ai/persona";
import {
  getNutritionTargets,
  getNutritionLogsForDate,
  computeMacroTotals,
  getWorkouts,
} from "@/lib/db/queries/health";

type Client = SupabaseClient<Database>;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function buildSystemPrompt(supabase: Client) {
  const today = todayStr();
  const [targets, todayLogs, recentWorkouts, persona] = await Promise.all([
    getNutritionTargets(supabase),
    getNutritionLogsForDate(supabase, today),
    getWorkouts(supabase),
    buildPersonaPrefix(supabase),
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
    persona,
    "In this conversation specifically, you're JARVIS acting as Health & Nutrition Mentor: (1) parse meal descriptions into estimated macros and log them via the log_nutrition_entry tool, (2) evaluate training routines the user describes, (3) answer general health/nutrition questions.",
    "When the user describes something they ate or are about to eat, estimate its macros as best you can and call log_nutrition_entry — don't ask clarifying questions unless the description is too vague to estimate at all.",
    "Keep replies concise (2-4 sentences) unless the user asks for depth.",
    "The context below is internal data with snake_case/camelCase keys (like protein_g, nutritionSoFarToday) — never quote those key names back to the user. Translate every number into plain, natural language (e.g. say \"your protein today\", not the raw key).",
    `The user's current context as JSON: ${JSON.stringify(context)}`,
  ].join("\n\n");
}

export async function runMentorChat(supabase: Client, userContent: string) {
  const provider = getMentorProvider();

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
  const messages: MentorChatMessage[] = history
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // The actual DB write lives here, not in the provider — see MentorProvider's
  // doc comment on nutritionChat for why.
  async function executeTool(args: LoggedMealArgs): Promise<string> {
    const { error: logErr } = await supabase.from("nutrition_logs").insert({
      meal_type: args.meal_type,
      description: args.description,
      calories: Math.round(Number(args.calories) || 0),
      protein_g: Number(args.protein_g) || 0,
      carbs_g: Number(args.carbs_g) || 0,
      fat_g: Number(args.fat_g) || 0,
      source: "chatbot",
      logged_at: todayStr(),
    });
    return logErr ? `Failed to log: ${logErr.message}` : "Logged successfully.";
  }

  const finalContent = await provider.nutritionChat(systemPrompt, messages, executeTool);

  const { data: assistantRow, error: insertAssistantErr } = await supabase
    .from("mentor_messages")
    .insert({ role: "assistant", content: finalContent, context: "nutrition" })
    .select()
    .single();
  if (insertAssistantErr) throw new Error(insertAssistantErr.message);

  return assistantRow;
}
