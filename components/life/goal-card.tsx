"use client";

import { useState, useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { deleteGoalAction, updateGoalProgressAction } from "@/actions/life-actions";
import type { Database } from "@/lib/supabase/database.types";

type Goal = Database["public"]["Tables"]["goals"]["Row"];

export function GoalCard({ goal }: { goal: Goal }) {
  const [progress, setProgress] = useState(goal.progress_percent);
  const [isPending, startTransition] = useTransition();

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
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition-opacity",
        isPending && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{goal.title}</p>
          {goal.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{goal.description}</p>
          ) : null}
        </div>
        <button
          onClick={handleDelete}
          aria-label="Delete goal"
          className="relative after:absolute after:-inset-3.5 shrink-0 text-muted-foreground hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {goal.category ? (
          <Badge variant="secondary" className="text-[10px]">
            {goal.category}
          </Badge>
        ) : null}
        {goal.status === "achieved" ? (
          <Badge className="bg-success/20 text-success text-[10px]">Achieved</Badge>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Progress value={progress} className="h-2 flex-1" />
        <span className="w-10 shrink-0 font-mono text-xs text-brand">{progress}%</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => adjust(-10)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          aria-label="Decrease progress"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => adjust(10)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          aria-label="Increase progress"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
