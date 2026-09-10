"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteTaskAction, toggleTaskStatusAction } from "@/actions/life-actions";
import type { Database } from "@/lib/supabase/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

/**
 * Filled tints, not outlines. Priority is real information so it keeps its
 * colour, but three outlined pills per row across a full task list turned
 * the board into a wall of coloured rectangles.
 */
const PRIORITY_TONE: Record<string, string> = {
  high: "bg-danger/12 text-danger",
  medium: "bg-warn/12 text-warn",
  low: "bg-white/[0.06] text-foreground-tertiary",
};

export function TaskItem({ task }: { task: Task }) {
  const [done, setDone] = useState(task.status === "done");
  const [isPending, startTransition] = useTransition();

  function handleToggle(checked: boolean) {
    setDone(checked); // instant UI feedback
    startTransition(async () => {
      try {
        await toggleTaskStatusAction(task.id, checked);
      } catch {
        setDone(!checked); // revert on failure
      }
    });
  }

  function handleDelete() {
    startTransition(() => deleteTaskAction(task.id));
  }

  return (
    <li
      className={cn(
        "surface surface-interactive flex items-start gap-3 px-3.5 py-2.5",
        isPending && "opacity-70",
        // A completed row recedes rather than being struck through in a
        // different colour — the checkbox already says what happened.
        done && "opacity-60",
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={(c) => handleToggle(c === true)}
        className="mt-0.5"
        aria-label={`Mark "${task.title}" ${done ? "not done" : "done"}`}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-body", done && "text-foreground-tertiary line-through")}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase",
              PRIORITY_TONE[task.priority],
            )}
          >
            {task.priority}
          </span>
          {task.due_date ? (
            <span className="tabular text-caption text-foreground-tertiary">
              {task.due_date}
            </span>
          ) : null}
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/[0.05] px-2 py-0.5 text-caption text-foreground-tertiary"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={handleDelete}
        aria-label="Delete task"
        className="relative text-foreground-tertiary transition-colors after:absolute after:-inset-3.5 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
