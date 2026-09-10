"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className={cn("surface px-4 py-3 transition-opacity", isPending && "opacity-70")}>
      {/* A session row reads left-to-right: what it was, then what it came
          to. The volume and exercise count used to be buried in the middle
          of a single grey sentence; as right-aligned figures a list of
          sessions can be scanned down its own column, which is the whole
          point of a training log. */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <Checkbox
            checked={completed}
            onCheckedChange={(c) => handleToggle(c === true)}
            className="mt-0.5"
            aria-label="Mark session completed"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* NOT struck through when completed. A finished workout is an
                  achievement; strikethrough is the visual language of a
                  cancelled item, and it was being applied to every session
                  in the log. */}
              <p className="truncate text-body font-medium text-foreground">{workout.session_label}</p>
              {workout.source === "hevy" ? (
                <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] tracking-[0.12em] text-foreground-tertiary uppercase">
                  Hevy
                </span>
              ) : null}
            </div>
            <p className="tabular mt-0.5 text-caption text-foreground-tertiary">
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {" · "}
              {completed ? "Completed" : "In progress"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-4">
          {sets.length > 0 ? (
            <dl className="hidden text-right sm:block">
              <dt className="eyebrow">Volume</dt>
              <dd className="tabular mt-1 text-body font-medium text-foreground">
                {volumeLbs} <span className="text-foreground-tertiary">lbs</span>
              </dd>
              <dd className="mt-0.5 text-caption text-foreground-tertiary">
                {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"}
              </dd>
            </dl>
          ) : null}
          <ConfirmDeleteButton onDelete={handleDelete} isPending={isPending} label="session" />
        </div>
      </div>

      {workout.notes ? <p className="mt-2 text-caption text-foreground-tertiary">{workout.notes}</p> : null}

      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-2.5 flex items-center gap-1 text-caption font-medium text-brand hover:underline"
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
