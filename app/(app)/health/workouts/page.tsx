import { createClient } from "@/lib/supabase/server";
import { getExercises, getWorkouts, getWorkoutSets } from "@/lib/db/queries/health";
import { ensureDefaultExercisesAction } from "@/actions/health-actions";
import { WorkoutForm } from "@/components/health/workout-form";
import { ExerciseForm } from "@/components/health/exercise-form";
import { WorkoutSessionCard } from "@/components/health/workout-session-card";
import { StreakHeatmap } from "@/components/shared/streak-heatmap";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { HEALTH_TABS } from "@/lib/nav-items";

export default async function WorkoutsPage() {
  await ensureDefaultExercisesAction();

  const supabase = await createClient();
  const exercises = await getExercises(supabase);
  const workouts = await getWorkouts(supabase);
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
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Last 90 days</p>
        <div className="mt-2">
          <StreakHeatmap completedDates={trainedDates} days={90} />
        </div>
      </div>

      {workouts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No sessions logged yet — start one above.
        </p>
      ) : (
        <div className="space-y-3">
          {workouts.map((workout) => (
            <WorkoutSessionCard
              key={workout.id}
              workout={workout}
              sets={setsByWorkout.get(workout.id) ?? []}
              exercises={exercises}
            />
          ))}
        </div>
      )}
    </div>
  );
}
