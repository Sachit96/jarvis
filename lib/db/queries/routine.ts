import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getHabits, getHabitLogsForHeatmap, getTasks, getJournalEntries, computeStreak } from "@/lib/db/queries/life";
import { getWorkouts, getNutritionTargets, getNutritionLogsForDate, computeMacroTotals } from "@/lib/db/queries/health";
import { getDailyRecommendation } from "@/lib/db/queries/mentor";

type Client = SupabaseClient<Database>;

export interface RoutineItem {
  id: string;
  label: string;
  completed: boolean;
  /** Manual items are habit rows the user toggles themselves; auto items are read-only, derived from data tracked elsewhere. */
  kind: "manual" | "auto";
  streak?: { current: number; best: number };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Today's Daily Routine checklist — manual habit toggles plus auto-derived
 * items computed from real data that already exists elsewhere (workouts,
 * nutrition, tasks, the daily brief, journal). Auto items are deliberately
 * not stored as separate habit_logs rows — that would create a second,
 * possibly-conflicting source of truth for something the app already knows.
 */
export async function getTodayRoutineItems(supabase: Client): Promise<RoutineItem[]> {
  const today = todayStr();

  const [habits, tasks, workouts, nutritionTargets, todayNutritionLogs, todayBrief, journalEntries] = await Promise.all([
    getHabits(supabase),
    getTasks(supabase),
    getWorkouts(supabase),
    getNutritionTargets(supabase),
    getNutritionLogsForDate(supabase, today),
    getDailyRecommendation(supabase, today),
    getJournalEntries(supabase),
  ]);

  const logs = await getHabitLogsForHeatmap(
    supabase,
    habits.map((h) => h.id),
  );
  const todayLogByHabit = new Map(logs.filter((l) => l.log_date === today).map((l) => [l.habit_id, l]));
  const completedDatesByHabit = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!log.completed) continue;
    const set = completedDatesByHabit.get(log.habit_id) ?? new Set<string>();
    set.add(log.log_date);
    completedDatesByHabit.set(log.habit_id, set);
  }

  const manualItems: RoutineItem[] = habits.map((h) => ({
    id: h.id,
    label: h.name,
    completed: todayLogByHabit.get(h.id)?.completed ?? false,
    kind: "manual",
    streak: computeStreak(completedDatesByHabit.get(h.id) ?? new Set()),
  }));

  const trainedToday = workouts.some((w) => w.started_at.slice(0, 10) === today);
  const macros = computeMacroTotals(todayNutritionLogs);
  const proteinTarget = nutritionTargets?.target_protein_g ?? 0;
  const proteinGoalMet = proteinTarget > 0 && macros.protein_g >= proteinTarget;
  const topPriorityDoneToday = tasks.some(
    (t) => t.priority === "high" && t.status === "done" && t.completed_at?.slice(0, 10) === today,
  );
  const journaledToday = journalEntries.some((j) => j.entry_date === today);

  const autoItems: RoutineItem[] = [
    { id: "auto-workout", label: "Workout", completed: trainedToday, kind: "auto" },
    { id: "auto-protein", label: "Hit protein goal", completed: proteinGoalMet, kind: "auto" },
    { id: "auto-top-priority", label: "Complete today's top priority", completed: topPriorityDoneToday, kind: "auto" },
    { id: "auto-brief", label: "Review AI Morning Brief", completed: Boolean(todayBrief), kind: "auto" },
    { id: "auto-journal", label: "Journal", completed: journaledToday, kind: "auto" },
  ];

  return [...manualItems, ...autoItems];
}
