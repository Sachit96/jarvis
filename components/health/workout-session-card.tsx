"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { deleteWorkoutAction, toggleWorkoutCompletedAction } from "@/actions/health-actions";
import { computeWorkoutVolume } from "@/lib/db/queries/health";
import { formatLbs } from "@/lib/units";
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
  const [expanded, setExpanded] = useState(false);
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
  const exerciseCount = new Set(sets.map((s) => s.exercise_id)).size;
  const volumeLbs = sets.length > 0 ? formatLbs(computeWorkoutVolume(sets)) : null;

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
            <div className="flex items-center gap-1.5">
              <p className={cn("text-sm font-medium", completed && "text-muted-foreground line-through")}>
                {workout.session_label}
              </p>
              {workout.source === "hevy" ? (
                <Badge variant="outline" className="text-[10px] uppercase">
                  Hevy
                </Badge>
              ) : null}
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {" · "}
              {completed ? "Completed" : "In progress"}
              {sets.length > 0 ? ` · ${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"} · ${volumeLbs} lbs total volume` : ""}
            </p>
          </div>
        </div>
        <ConfirmDeleteButton onDelete={handleDelete} isPending={isPending} label="session" />
      </div>

      {workout.notes ? <p className="mt-2 text-xs text-muted-foreground">{workout.notes}</p> : null}

      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-brand hover:underline"
      >
        {expanded ? "Hide" : sets.length > 0 ? `Show ${sets.length} set${sets.length === 1 ? "" : "s"}` : "Log a set"}
        <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} strokeWidth={2.5} />
      </button>

      {expanded ? (
        <>
          {sets.length > 0 ? (
            <ul className="mt-2 space-y-1.5 border-t border-border pt-2">
              {sets.map((s) => (
                <WorkoutSetItem key={s.id} set={s} exerciseName={exerciseNameById.get(s.exercise_id) ?? "?"} />
              ))}
            </ul>
          ) : null}

          {/* Mounted only while expanded — with 20+ sessions on screen at
              once, an always-mounted form per card (select + 2 inputs +
              button, per session) was most of the "138 inputs, 97 buttons"
              found live auditing this page (2026-09-06). */}
          <div className="mt-3">
            <AddSetForm workoutId={workout.id} exercises={exercises} nextSetNumber={sets.length + 1} />
          </div>
        </>
      ) : null}
    </div>
  );
}
