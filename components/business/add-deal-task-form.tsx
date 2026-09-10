"use client";

import { useActionState, useRef, useEffect } from "react";
import { createDealTaskAction } from "@/actions/business-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";

const initialState: ActionState = {};

export function AddDealTaskForm({ dealId }: { dealId: string }) {
  const [state, formAction, isPending] = useActionState(createDealTaskAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-start gap-2">
      <input type="hidden" name="deal_id" value={dealId} />
      <div className="min-w-40 flex-1">
        <Input name="title" placeholder="Follow-up task…" {...fieldAria(state, "title")} />
        <FieldError id="title-error" message={state.fieldErrors?.title} />
      </div>
      {/* The action has always accepted a due date; nothing ever sent one, so
          every task landed undated and the overdue signal could never fire. */}
      <Input
        type="date"
        name="due_date"
        aria-label="Due date"
        className="w-36 shrink-0 text-foreground-secondary"
      />
      <Button type="submit" variant="secondary" className="shrink-0" disabled={isPending}>
        Add
      </Button>
      {state.error ? <FieldError id="deal-task-error" message={state.error} /> : null}
    </form>
  );
}
