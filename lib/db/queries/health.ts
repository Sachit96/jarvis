import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type NutritionLogRow = Database["public"]["Tables"]["nutrition_logs"]["Row"];
type WorkoutSetRow = Database["public"]["Tables"]["workout_sets"]["Row"];

// ============================================================= Workouts

export async function getExercises(supabase: Client) {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

const WORKOUT_HISTORY_DAYS = 90;

export async function getWorkouts(supabase: Client) {
  const since = new Date();
  since.setDate(since.getDate() - WORKOUT_HISTORY_DAYS);
  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getWorkoutSets(supabase: Client, workoutIds: string[]) {
  if (workoutIds.length === 0) return [];
  const { data, error } = await supabase
    .from("workout_sets")
    .select("*")
    .in("workout_id", workoutIds)
    .order("set_number", { ascending: true });
  if (error) throw error;
  return data;
}

/** Total volume (weight x reps, summed across sets) — the standard training-load metric. */
export function computeWorkoutVolume(sets: Pick<WorkoutSetRow, "weight_kg" | "reps">[]): number {
  return sets.reduce((sum, s) => sum + Number(s.weight_kg ?? 0) * Number(s.reps ?? 0), 0);
}

// ============================================================= Nutrition

export async function getNutritionTargets(supabase: Client) {
  const { data, error } = await supabase.from("nutrition_targets").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function getNutritionLogsForDate(supabase: Client, date: string) {
  const { data, error } = await supabase
    .from("nutrition_logs")
    .select("*")
    .eq("logged_at", date)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export function computeMacroTotals(logs: Pick<NutritionLogRow, "calories" | "protein_g" | "carbs_g" | "fat_g">[]) {
  return logs.reduce(
    (acc, l) => ({
      calories: acc.calories + Number(l.calories),
      protein_g: acc.protein_g + Number(l.protein_g),
      carbs_g: acc.carbs_g + Number(l.carbs_g),
      fat_g: acc.fat_g + Number(l.fat_g),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

export async function getWaterTotalForDate(supabase: Client, date: string) {
  const { data, error } = await supabase.from("water_logs").select("amount_ml").eq("log_date", date);
  if (error) throw error;
  return data.reduce((sum, w) => sum + w.amount_ml, 0);
}

// ============================================================= Body metrics (weight)

const BODY_METRICS_HISTORY_DAYS = 90;

export async function getBodyMetrics(supabase: Client, days = BODY_METRICS_HISTORY_DAYS) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("body_metrics")
    .select("*")
    .gte("logged_at", since.toISOString().slice(0, 10))
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return data;
}

// ============================================================= Sleep

const SLEEP_HISTORY_DAYS = 30;

export async function getSleepLogs(supabase: Client, days = SLEEP_HISTORY_DAYS) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("sleep_logs")
    .select("*")
    .gte("log_date", since.toISOString().slice(0, 10))
    .order("log_date", { ascending: true });
  if (error) throw error;
  return data;
}

// ============================================================= Mentor chat

const MENTOR_HISTORY_LIMIT = 30;

export async function getMentorMessages(supabase: Client) {
  const { data, error } = await supabase
    .from("mentor_messages")
    .select("*")
    .eq("context", "nutrition")
    .order("created_at", { ascending: false })
    .limit(MENTOR_HISTORY_LIMIT);
  if (error) throw error;
  return data.reverse();
}
