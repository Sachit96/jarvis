"use client";

import { useActionState, useRef, useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createOnboardingTaskAction,
  deleteOnboardingTaskAction,
  toggleOnboardingTaskAction,
  type ActionState,
} from "@/actions/business-actions";
import type { Database } from "@/lib/supabase/database.types";

type OnboardingTask = Database["public"]["Tables"]["client_onboarding_tasks"]["Row"];

const initialState: ActionState = {};

function OnboardingTaskRow({ task }: { task: OnboardingTask }) {
  const [completed, setCompleted] = useState(task.completed);
  const [isPending, startTransition] = useTransition();

  function handleToggle(checked: boolean) {
    setCompleted(checked);
    startTransition(async () => {
      try {
        await toggleOnboardingTaskAction(task.id, checked);
      } catch {
        setCompleted(!checked);
      }
    });
  }

  return (
    <li className={cn("flex items-center gap-2 text-xs", isPending && "opacity-50")}>
      <Checkbox checked={completed} onCheckedChange={(c) => handleToggle(c === true)} className="h-3.5 w-3.5" />
      <span className={cn("flex-1", completed && "text-muted-foreground line-through")}>{task.label}</span>
      <button
        onClick={() => startTransition(() => deleteOnboardingTaskAction(task.id))}
        aria-label="Delete onboarding task"
        className="text-muted-foreground hover:text-danger"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}

export function OnboardingChecklist({ contactId, tasks }: { contactId: string; tasks: OnboardingTask[] }) {
  const [state, formAction, isPending] = useActionState(createOnboardingTaskAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  const doneCount = tasks.filter((t) => t.completed).length;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Onboarding {tasks.length > 0 ? `(${doneCount}/${tasks.length})` : ""}
      </p>
      {tasks.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {tasks.map((t) => (
            <OnboardingTaskRow key={t.id} task={t} />
          ))}
        </ul>
      ) : null}
      <form ref={formRef} action={formAction} className="mt-1.5 flex items-center gap-1.5">
        <input type="hidden" name="contact_id" value={contactId} />
        <Input name="label" placeholder="Add checklist item…" className="h-6 flex-1 text-xs" />
        <Button type="submit" size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={isPending}>
          Add
        </Button>
      </form>
    </div>
  );
}
