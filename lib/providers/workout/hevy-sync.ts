import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { listRecentHevyWorkouts, hasHevyKey } from "@/lib/providers/workout/hevy-client";

type Client = SupabaseClient<Database>;
type WorkoutSetInsert = Database["public"]["Tables"]["workout_sets"]["Insert"];

export interface HevySyncResult {
  ok: boolean;
  message: string;
  workoutsSynced: number;
}

/**
 * Pulls the most recent Hevy workouts and upserts them into workouts/
 * exercises/workout_sets, tagged source='hevy' + external_id for idempotent
 * re-sync. A synced workout's sets are replaced wholesale each run (delete +
 * reinsert) rather than diffed individually — simpler than giving every set
 * its own external identity, and cheap at personal scale.
 */
export async function syncHevyWorkouts(supabase: Client, pageSize = 10): Promise<HevySyncResult> {
  if (!hasHevyKey()) {
    return { ok: false, message: "HEVY_API_KEY is not configured", workoutsSynced: 0 };
  }

  const hevyWorkouts = await listRecentHevyWorkouts(pageSize);
  let synced = 0;

  for (const hw of hevyWorkouts) {
    const { data: workout, error: workoutErr } = await supabase
      .from("workouts")
      .upsert(
        {
          external_id: hw.id,
          source: "hevy",
          session_label: hw.title || "Hevy Workout",
          started_at: hw.start_time,
          completed: true,
        },
        { onConflict: "external_id" },
      )
      .select()
      .single();
    if (workoutErr || !workout) continue;

    await supabase.from("workout_sets").delete().eq("workout_id", workout.id);

    const setRows: WorkoutSetInsert[] = [];
    let setNumber = 0;
    for (const ex of hw.exercises) {
      const { data: exerciseRow, error: exErr } = await supabase
        .from("exercises")
        .upsert(
          { external_id: ex.exercise_template_id, source: "hevy", name: ex.title },
          { onConflict: "external_id" },
        )
        .select()
        .single();
      if (exErr || !exerciseRow) continue;

      for (const set of ex.sets) {
        setNumber += 1;
        setRows.push({
          workout_id: workout.id,
          exercise_id: exerciseRow.id,
          set_number: setNumber,
          weight_kg: set.weight_kg,
          reps: set.reps,
        });
      }
    }

    if (setRows.length > 0) {
      await supabase.from("workout_sets").insert(setRows);
    }
    synced += 1;
  }

  return { ok: true, message: `Synced ${synced} workout(s) from Hevy.`, workoutsSynced: synced };
}
