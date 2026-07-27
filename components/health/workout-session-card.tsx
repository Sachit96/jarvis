"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteWorkoutAction, toggleWorkoutCompletedAction } from "@/actions/health-actions";
import { AddSetForm } from "@/components/health/add-set-form";
import { WorkoutSetItem } from "@/components/health/workout-set-item";
import type { Database } from "@/lib/supabase/database.types";

type Workout = Database["public"]["Tables"]["workouts"]["Row"];
type WorkoutSet = Database["public"]["Tables"]["workout_sets"]["Row"];
type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

export function WorkoutSessionCard({
  workout,
  sets,
  exercises,
}: {
  workout: Workout;
  sets: WorkoutSet[];
  exercises: Exercise[];
}) {
  const [completed, setCompleted] = useState(workout.completed);
  const [isPending, startTransition] = useTransition();
  const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));

  function handleToggle(checked: boolean) {
    setCompleted(checked);
    startTransition(async () => {
      try {
        await toggleWorkoutCompletedAction(workout.id, checked);
      } catch {
        setCompleted(!checked);
      }
    });
  }

  function handleDelete() {
    startTransition(() => deleteWorkoutAction(workout.id));
  }

  const date = new Date(workout.started_at);

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 transition-opacity", isPending && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Checkbox
            checked={completed}
            onCheckedChange={(c) => handleToggle(c === true)}
            className="mt-0.5"
            aria-label="Mark session completed"
          />
          <div>
            <p className={cn("text-sm font-medium", completed && "text-muted-foreground line-through")}>
              {workout.session_label}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <button onClick={handleDelete} aria-label="Delete session" className="text-muted-foreground hover:text-danger">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {workout.notes ? <p className="mt-2 text-xs text-muted-foreground">{workout.notes}</p> : null}

      {sets.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {sets.map((s) => (
            <WorkoutSetItem key={s.id} set={s} exerciseName={exerciseNameById.get(s.exercise_id) ?? "?"} />
          ))}
        </ul>
      ) : null}

      <div className="mt-3">
        <AddSetForm workoutId={workout.id} exercises={exercises} nextSetNumber={sets.length + 1} />
      </div>
    </div>
  );
}
