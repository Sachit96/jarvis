"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { deleteTaskAction, toggleTaskStatusAction } from "@/actions/life-actions";
import type { Database } from "@/lib/supabase/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const PRIORITY_TONE: Record<string, string> = {
  high: "text-danger border-danger/40",
  medium: "text-warn border-warn/40",
  low: "text-muted-foreground border-border",
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
        "flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-opacity",
        isPending && "opacity-70",
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={(c) => handleToggle(c === true)}
        className="mt-0.5"
        aria-label={`Mark "${task.title}" ${done ? "not done" : "done"}`}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", done && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("font-mono text-[10px] uppercase", PRIORITY_TONE[task.priority])}
          >
            {task.priority}
          </Badge>
          {task.due_date ? (
            <span className="font-mono text-xs text-muted-foreground">
              {task.due_date}
            </span>
          ) : null}
          {task.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <button
        onClick={handleDelete}
        aria-label="Delete task"
        className="relative after:absolute after:-inset-3.5 text-muted-foreground hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
