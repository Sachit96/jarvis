"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  exerciseSchema,
  workoutSchema,
  workoutSetSchema,
  nutritionTargetsSchema,
  nutritionLogSchema,
  waterLogSchema,
  mentorMessageSchema,
  DEFAULT_EXERCISES,
} from "@/lib/validations/health";
import { runMentorChat } from "@/lib/ai/mentor";

export interface ActionState {
  error?: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function revalidateHealth() {
  revalidatePath("/health/workouts");
  revalidatePath("/health/nutrition");
}

// ============================================================= Exercises

export async function ensureDefaultExercisesAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { count, error: countError } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);
  if (count && count > 0) return;

  const { error } = await supabase
    .from("exercises")
    .insert(DEFAULT_EXERCISES.map((e) => ({ ...e, user_id: user.id })));
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
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("exercises").insert({
    user_id: user.id,
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
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("workouts").insert({
    user_id: user.id,
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
    weight_kg: formData.get("weight_kg") || undefined,
    reps: formData.get("reps") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("workout_sets").insert({
    user_id: user.id,
    workout_id: parsed.data.workout_id,
    exercise_id: parsed.data.exercise_id,
    set_number: parsed.data.set_number,
    weight_kg: parsed.data.weight_kg ?? null,
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
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("nutrition_targets")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
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
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("nutrition_logs").insert({
    user_id: user.id,
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.from("water_logs").insert({
    user_id: user.id,
    log_date: todayStr(),
    amount_ml: parsed.data.amount_ml,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/health/nutrition");
}

// ============================================================= Mentor chat

export interface MentorActionState {
  error?: string;
  reply?: string;
}

export async function sendMentorMessageAction(content: string): Promise<MentorActionState> {
  const parsed = mentorMessageSchema.safeParse({ content });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  try {
    const assistantRow = await runMentorChat(supabase, user.id, parsed.data.content);
    revalidatePath("/health/nutrition");
    return { reply: assistantRow.content };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Mentor chat failed" };
  }
}
