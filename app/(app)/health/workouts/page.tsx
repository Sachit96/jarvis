import { createClient } from "@/lib/supabase/server";
import { getExercises, getWorkouts, getWorkoutSets } from "@/lib/db/queries/health";
import { ensureDefaultExercisesAction } from "@/actions/health-actions";
import { hasHevyKey } from "@/lib/providers/workout/hevy-client";
import { WorkoutForm } from "@/components/health/workout-form";
import { ExerciseForm } from "@/components/health/exercise-form";
import { WorkoutsList } from "@/components/health/workouts-list";
import { HevySyncButton } from "@/components/health/hevy-sync-button";
import { HevyAutoSync } from "@/components/health/hevy-auto-sync";
import { WorkoutCalendar } from "@/components/health/workout-calendar";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { HEALTH_TABS } from "@/lib/nav-items";

export default async function WorkoutsPage() {
  await ensureDefaultExercisesAction();

  const supabase = await createClient();
  const connected = hasHevyKey();

  const [exercises, workouts] = await Promise.all([getExercises(supabase), getWorkouts(supabase)]);
  const sets = await getWorkoutSets(
    supabase,
    workouts.map((w) => w.id),
  );

  const setsByWorkout = new Map<string, typeof sets>();
  for (const s of sets) {
    const list = setsByWorkout.get(s.workout_id) ?? [];
    list.push(s);
    setsByWorkout.set(s.workout_id, list);
  }

  const trainedDates = new Set(workouts.map((w) => w.started_at.slice(0, 10)));

  return (
    <div className="space-y-6">
      {connected ? <HevyAutoSync /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Health</p>
          <h1 className="text-xl font-semibold">Workouts</h1>
        </div>
        <div className="flex gap-2">
          <ExerciseForm />
          <WorkoutForm />
        </div>
      </div>

      <ModuleTabs tabs={HEALTH_TABS} />

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-1 flex items-center justify-end">
          <HevySyncButton connected={connected} />
        </div>
        <WorkoutCalendar trainedDates={trainedDates} />
      </div>

      {workouts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No sessions logged yet — start one above.
        </p>
      ) : (
        <WorkoutsList
          rows={workouts.map((workout) => ({ workout, sets: setsByWorkout.get(workout.id) ?? [] }))}
          exercises={exercises}
        />
      )}
    </div>
  );
}
