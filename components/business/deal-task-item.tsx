"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteDealTaskAction, toggleDealTaskAction } from "@/actions/business-actions";
import type { Database } from "@/lib/supabase/database.types";

type DealTask = Database["public"]["Tables"]["deal_tasks"]["Row"];

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

  return (
    <li className={cn("flex items-center gap-2 text-xs", isPending && "opacity-50")}>
      <Checkbox checked={completed} onCheckedChange={(c) => handleToggle(c === true)} className="h-3.5 w-3.5" />
      <span className={cn("flex-1", completed && "text-muted-foreground line-through")}>{task.title}</span>
      {task.due_date ? <span className="font-mono text-muted-foreground">{task.due_date}</span> : null}
      <button
        onClick={() => startTransition(() => deleteDealTaskAction(task.id))}
        aria-label="Delete task"
        className="text-muted-foreground hover:text-danger"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}
