"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteDealTaskAction, toggleDealTaskAction } from "@/actions/business-actions";
import { todayStr } from "@/lib/date";
import type { Database } from "@/lib/supabase/database.types";

type DealTask = Database["public"]["Tables"]["deal_tasks"]["Row"];

/** "Today", "Overdue", or a short date — the raw ISO string told you nothing at a glance. */
function dueLabel(due: string) {
  const today = todayStr();
  if (due === today) return { text: "Today", tone: "text-warn" };
  if (due < today) return { text: "Overdue", tone: "text-danger" };
  const [y, m, d] = due.split("-").map(Number);
  return {
    text: new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    tone: "text-foreground-tertiary",
  };
}

export function DealTaskItem({ task }: { task: DealTask }) {
  const [completed, setCompleted] = useState(task.completed);
  const [isPending, startTransition] = useTransition();

  function handleToggle(checked: boolean) {
    setCompleted(checked);
    startTransition(async () => {
      try {
        await toggleDealTaskAction(task.id, checked);
      } catch {
        setCompleted(!checked);
      }
    });
  }

  const due = task.due_date && !completed ? dueLabel(task.due_date) : null;

  return (
    <li className={cn("group/task flex items-center gap-2.5 text-body", isPending && "opacity-50")}>
      <Checkbox checked={completed} onCheckedChange={(c) => handleToggle(c === true)} className="size-4" />
      <span className={cn("min-w-0 flex-1 truncate", completed && "text-foreground-tertiary line-through")}>
        {task.title}
      </span>
      {due ? <span className={cn("tabular shrink-0 text-caption", due.tone)}>{due.text}</span> : null}
      <button
        onClick={() => startTransition(() => deleteDealTaskAction(task.id))}
        aria-label={`Delete task ${task.title}`}
        className="relative shrink-0 text-foreground-tertiary opacity-0 transition-opacity after:absolute after:-inset-3.5 group-hover/task:opacity-100 hover:text-danger focus-visible:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}
