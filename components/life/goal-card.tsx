"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { deleteGoalAction, updateGoalProgressAction } from "@/actions/life-actions";
import type { Database } from "@/lib/supabase/database.types";

type Goal = Database["public"]["Tables"]["goals"]["Row"];

function formatTarget(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * A goal as a mission objective (§10) rather than a row with a bar.
 *
 * The structure is the point: status, the objective, its progress as a
 * measured figure, and its deadline — the four things you would actually
 * want on a board. The sci-fi vocabulary is kept to the micro-labels and
 * stops there; naming the buttons "ADJUST TRAJECTORY" would be a costume,
 * not a design.
 */
export function GoalCard({ goal }: { goal: Goal }) {
  const [progress, setProgress] = useState(goal.progress_percent);
  const [isPending, startTransition] = useTransition();
  const achieved = goal.status === "achieved";

  function adjust(delta: number) {
    const next = Math.max(0, Math.min(100, progress + delta));
    const prev = progress;
    setProgress(next); // instant UI feedback
    startTransition(async () => {
      try {
        await updateGoalProgressAction(goal.id, next);
      } catch {
        setProgress(prev);
      }
    });
  }

  function handleDelete() {
    startTransition(() => deleteGoalAction(goal.id));
  }

  return (
    <Card
      padding="compact"
      elevation={achieved ? "raised" : "default"}
      className={cn("gap-0 transition-opacity", isPending && "opacity-70")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="eyebrow">{achieved ? "Achieved" : "Objective"}</p>
            {goal.category ? (
              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-caption text-foreground-tertiary">
                {goal.category}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-body font-medium text-foreground">{goal.title}</p>
          {goal.description ? (
            <p className="mt-0.5 text-caption text-foreground-tertiary">{goal.description}</p>
          ) : null}
        </div>
        <ConfirmDeleteButton onDelete={handleDelete} isPending={isPending} label="goal" />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="tabular font-display text-metric text-foreground">{progress}%</p>
        {goal.target_date ? (
          <p className="flex items-center gap-1.5 pb-1 text-caption text-foreground-tertiary">
            <CalendarClock className="size-3.5" strokeWidth={1.75} />
            {formatTarget(goal.target_date)}
          </p>
        ) : null}
      </div>

      {/* One track, brand-filled — the same progress language as the goals
          rail on Home and the Life Score meters, not a third bar style. */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="gradient-brand h-full rounded-full transition-[width] duration-500 ease-[var(--ease-jarvis)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => adjust(-10)}
          className="press flex size-7 items-center justify-center rounded-full bg-white/[0.05] text-foreground-tertiary transition-colors hover:bg-white/[0.1] hover:text-white"
          aria-label="Decrease progress"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          onClick={() => adjust(10)}
          className="press flex size-7 items-center justify-center rounded-full bg-white/[0.05] text-foreground-tertiary transition-colors hover:bg-white/[0.1] hover:text-white"
          aria-label="Increase progress"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </Card>
  );
}
