import "server-only";
import { z } from "zod";
import {
  getWorkouts,
  getWorkoutSets,
  getExercises,
  getBodyMetrics,
  computeWorkoutVolume,
} from "@/lib/db/queries/health";
import { getHevyStatus } from "@/lib/integrations/hevy";
import { todayStr } from "@/lib/date";
import { ok, type ToolDefinition } from "@/lib/ai/tools/types";

/**
 * Health tools beyond the daily summary.
 *
 * All of these read the Supabase copy, which is the source of truth whether
 * or not Hevy is connected — manual logging has always worked. Each result
 * carries the Hevy status alongside the data so the model can explain a thin
 * history ("sync isn't set up, so this is only what you logged by hand")
 * instead of concluding the user stopped training.
 */

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export const getRecentWorkoutsTool: ToolDefinition = {
  name: "get_recent_workouts",
  description:
    "Recent training sessions with their date, label and per-exercise sets. Use for 'what was my last workout' and 'how often have I trained'.",
  domain: "health",
  risk: "safe",
  schema: z.object({
    days: z.number().optional().describe("How far back to look. Defaults to 30."),
  }),
  async handler(args, { supabase }) {
    const { days } = args as { days?: number };
    const window = Math.min(Math.max(days ?? 30, 1), 365);
    const since = daysAgoIso(window);

    const [workouts, exercises] = await Promise.all([getWorkouts(supabase), getExercises(supabase)]);
    const recent = workouts.filter((w) => w.started_at >= since);
    const sets = await getWorkoutSets(supabase, recent.map((w) => w.id));

    const exerciseById = new Map(exercises.map((e) => [e.id, e]));
    const setsByWorkout = new Map<string, typeof sets>();
    for (const s of sets) {
      const list = setsByWorkout.get(s.workout_id) ?? [];
      list.push(s);
      setsByWorkout.set(s.workout_id, list);
    }

    return ok({
      window_days: window,
      hevy_sync: getHevyStatus().state,
      session_count: recent.length,
      workouts: recent.map((w) => {
        const own = setsByWorkout.get(w.id) ?? [];
        return {
          id: w.id,
          label: w.session_label,
          started_at: w.started_at,
          completed: w.completed,
          set_count: own.length,
          volume_kg: computeWorkoutVolume(own),
          exercises: [...new Set(own.map((s) => exerciseById.get(s.exercise_id)?.name).filter(Boolean))],
        };
      }),
    });
  },
};

export const getTrainingProgressTool: ToolDefinition = {
  name: "get_training_progress",
  description:
    "Training volume and frequency over time, broken down by muscle group. Use for 'how has training been this month', 'what am I neglecting', and progress questions.",
  domain: "health",
  risk: "safe",
  schema: z.object({
    days: z.number().optional().describe("Window to analyse. Defaults to 30."),
  }),
  async handler(args, { supabase }) {
    const { days } = args as { days?: number };
    const window = Math.min(Math.max(days ?? 30, 1), 365);

    const [workouts, exercises] = await Promise.all([getWorkouts(supabase), getExercises(supabase)]);
    const since = daysAgoIso(window);
    const previousSince = daysAgoIso(window * 2);

    const current = workouts.filter((w) => w.started_at >= since);
    // The immediately preceding window of equal length, so "more or less
    // than usual" is a real comparison rather than an impression.
    const previous = workouts.filter((w) => w.started_at >= previousSince && w.started_at < since);

    const [currentSets, previousSets] = await Promise.all([
      getWorkoutSets(supabase, current.map((w) => w.id)),
      getWorkoutSets(supabase, previous.map((w) => w.id)),
    ]);

    const exerciseById = new Map(exercises.map((e) => [e.id, e]));
    const byMuscle = new Map<string, { sets: number; volume_kg: number }>();
    for (const s of currentSets) {
      // Exercises may have no muscle group recorded; bucketing them as
      // "unassigned" is honest, where dropping them would understate volume.
      const group = exerciseById.get(s.exercise_id)?.muscle_group ?? "unassigned";
      const entry = byMuscle.get(group) ?? { sets: 0, volume_kg: 0 };
      entry.sets += 1;
      entry.volume_kg += computeWorkoutVolume([s]);
      byMuscle.set(group, entry);
    }

    // Groups with exercises defined but nothing logged this window — the
    // direct answer to "what am I neglecting". Derived from the user's own
    // exercise library, so it never invents a body part they don't train.
    const trained = new Set(byMuscle.keys());
    const known = new Set(
      exercises.map((e) => e.muscle_group).filter((g): g is string => Boolean(g)),
    );
    const untrained = [...known].filter((g) => !trained.has(g)).sort();

    return ok({
      window_days: window,
      hevy_sync: getHevyStatus().state,
      sessions: current.length,
      sessions_previous_window: previous.length,
      volume_kg: computeWorkoutVolume(currentSets),
      volume_kg_previous_window: computeWorkoutVolume(previousSets),
      sessions_per_week: Math.round((current.length / window) * 7 * 10) / 10,
      by_muscle_group: Object.fromEntries(
        [...byMuscle.entries()].sort((a, b) => b[1].volume_kg - a[1].volume_kg),
      ),
      muscle_groups_not_trained: untrained,
    });
  },
};

export const getBodyMetricsTool: ToolDefinition = {
  name: "get_body_metrics",
  description: "Recorded body measurements over time — weight and any other tracked metrics.",
  domain: "health",
  risk: "safe",
  schema: z.object({
    days: z.number().optional().describe("How far back to look. Defaults to 90."),
  }),
  async handler(args, { supabase }) {
    const { days } = args as { days?: number };
    const window = Math.min(Math.max(days ?? 90, 1), 730);
    const metrics = await getBodyMetrics(supabase, window);
    return ok({
      window_days: window,
      today: todayStr(),
      hevy_sync: getHevyStatus().state,
      // Empty is a real answer here — it means nothing was recorded, not
      // that the lookup failed.
      measurements: metrics,
    });
  },
};

export const healthOpsTools = [getRecentWorkoutsTool, getTrainingProgressTool, getBodyMetricsTool];
