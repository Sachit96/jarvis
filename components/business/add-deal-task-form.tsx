"use client";

import { useActionState, useRef, useEffect } from "react";
import { createDealTaskAction, type ActionState } from "@/actions/business-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <form ref={formRef} action={formAction} className="mt-1.5 flex items-center gap-1.5">
      <input type="hidden" name="deal_id" value={dealId} />
      <Input name="title" placeholder="Follow-up task…" className="h-6 flex-1 text-xs" />
      <Button type="submit" size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={isPending}>
        Add
      </Button>
    </form>
  );
}
