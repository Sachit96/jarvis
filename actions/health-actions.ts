"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayStr } from "@/lib/date";
import {
  exerciseSchema,
  workoutSchema,
  workoutSetSchema,
  nutritionTargetsSchema,
  nutritionLogSchema,
  waterLogSchema,
  bodyMetricSchema,
  sleepLogSchema,
  mentorMessageSchema,
  DEFAULT_EXERCISES,
} from "@/lib/validations/health";
import { runMentorChat } from "@/lib/ai/mentor";
import { lbsToKg } from "@/lib/units";
import { actionStateFromZodError, type ActionState } from "@/lib/validation";

function revalidateHealth() {
  revalidatePath("/health/workouts");
  revalidatePath("/health/nutrition");
  revalidatePath("/health/body");
}

// ============================================================= Exercises

export async function ensureDefaultExercisesAction() {
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);
  if (count && count > 0) return;

  const { error } = await supabase.from("exercises").insert(DEFAULT_EXERCISES);
  if (error) throw new Error(error.message);
  // No revalidatePath — only ever called at the top of a Server Component's
  // render body, not from a client-triggered action; disallowed there in
  // production, and unnecessary since the page's own query right after this
  // already sees the fresh rows within the same request.
}

export async function createExerciseAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = exerciseSchema.safeParse({
    name: formData.get("name"),
    muscle_group: formData.get("muscle_group"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("exercises").insert({
    name: parsed.data.name,
    muscle_group: parsed.data.muscle_group || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/health/workouts");
  return {};
}

// ============================================================= Workouts

export async function createWorkoutAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = workoutSchema.safeParse({
    session_label: formData.get("session_label") || "Session",
    started_at: formData.get("started_at"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("workouts").insert({
    session_label: parsed.data.session_label,
    started_at: new Date(parsed.data.started_at).toISOString(),
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/health/workouts");
  return {};
}

export async function deleteWorkoutAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/health/workouts");
}

export async function toggleWorkoutCompletedAction(id: string, completed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("workouts").update({ completed }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/health/workouts");
}

export async function addWorkoutSetAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = workoutSetSchema.safeParse({
    workout_id: formData.get("workout_id"),
    exercise_id: formData.get("exercise_id"),
    set_number: formData.get("set_number") || 1,
    weight_lbs: formData.get("weight_lbs") || undefined,
    reps: formData.get("reps") || undefined,
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("workout_sets").insert({
    workout_id: parsed.data.workout_id,
    exercise_id: parsed.data.exercise_id,
    set_number: parsed.data.set_number,
    weight_kg: parsed.data.weight_lbs !== undefined ? lbsToKg(parsed.data.weight_lbs) : null,
    reps: parsed.data.reps ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/health/workouts");
  return {};
}

export async function deleteWorkoutSetAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("workout_sets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/health/workouts");
}

// ============================================================= Nutrition

export async function upsertNutritionTargetsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = nutritionTargetsSchema.safeParse({
    target_calories: formData.get("target_calories"),
    target_protein_g: formData.get("target_protein_g"),
    target_carbs_g: formData.get("target_carbs_g"),
    target_fat_g: formData.get("target_fat_g"),
    target_water_ml: formData.get("target_water_ml"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  // Exactly one row ever exists — no user_id to key an upsert on, so fetch
  // it first and update/insert accordingly.
  const { data: existing } = await supabase.from("nutrition_targets").select("id").maybeSingle();
  const { error } = existing
    ? await supabase.from("nutrition_targets").update(parsed.data).eq("id", existing.id)
    : await supabase.from("nutrition_targets").insert(parsed.data);
  if (error) return { error: error.message };
  revalidateHealth();
  return {};
}

export async function createNutritionLogAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = nutritionLogSchema.safeParse({
    meal_type: formData.get("meal_type") || "snack",
    logged_at: formData.get("logged_at") || todayStr(),
    description: formData.get("description"),
    calories: formData.get("calories") || 0,
    protein_g: formData.get("protein_g") || 0,
    carbs_g: formData.get("carbs_g") || 0,
    fat_g: formData.get("fat_g") || 0,
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("nutrition_logs").insert({
    meal_type: parsed.data.meal_type,
    logged_at: parsed.data.logged_at,
    description: parsed.data.description,
    calories: parsed.data.calories,
    protein_g: parsed.data.protein_g,
    carbs_g: parsed.data.carbs_g,
    fat_g: parsed.data.fat_g,
    source: "manual",
  });
  if (error) return { error: error.message };
  revalidatePath("/health/nutrition");
  return {};
}

export async function deleteNutritionLogAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("nutrition_logs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/health/nutrition");
}

export async function addWaterAction(amountMl: number) {
  const parsed = waterLogSchema.safeParse({ amount_ml: amountMl });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid amount");

  const supabase = await createClient();
  const { error } = await supabase.from("water_logs").insert({
    log_date: todayStr(),
    amount_ml: parsed.data.amount_ml,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/health/nutrition");
}

// ============================================================= Body metrics (weight)

export async function createBodyMetricAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = bodyMetricSchema.safeParse({
    logged_at: formData.get("logged_at") || todayStr(),
    weight_lbs: formData.get("weight_lbs"),
    body_fat_pct: formData.get("body_fat_pct") || undefined,
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  // One entry per day (unique on logged_at) — upsert so re-logging the same
  // day updates it instead of erroring.
  const { error } = await supabase.from("body_metrics").upsert(
    {
      logged_at: parsed.data.logged_at,
      weight_kg: lbsToKg(parsed.data.weight_lbs),
      body_fat_pct: parsed.data.body_fat_pct ?? null,
      notes: parsed.data.notes || null,
    },
    { onConflict: "logged_at" },
  );
  if (error) return { error: error.message };
  revalidatePath("/health/body");
  return {};
}

export async function deleteBodyMetricAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("body_metrics").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/health/body");
}

// ============================================================= Sleep

export async function createSleepLogAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = sleepLogSchema.safeParse({
    log_date: formData.get("log_date") || todayStr(),
    hours_slept: formData.get("hours_slept"),
    quality: formData.get("quality") || undefined,
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("sleep_logs").upsert(
    {
      log_date: parsed.data.log_date,
      hours_slept: parsed.data.hours_slept,
      quality: parsed.data.quality ?? null,
      notes: parsed.data.notes || null,
    },
    { onConflict: "log_date" },
  );
  if (error) return { error: error.message };
  revalidatePath("/health/body");
  return {};
}

export async function deleteSleepLogAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("sleep_logs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/health/body");
}

// ============================================================= Mentor chat

export interface MentorActionState {
  error?: string;
  reply?: string;
}

export async function sendMentorMessageAction(content: string): Promise<MentorActionState> {
  const parsed = mentorMessageSchema.safeParse({ content });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  try {
    const assistantRow = await runMentorChat(supabase, parsed.data.content);
    revalidatePath("/health/nutrition");
    return { reply: assistantRow.content };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Mentor chat failed" };
  }
}
