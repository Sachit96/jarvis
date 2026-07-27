"use client";

import { useActionState, useRef, useEffect } from "react";
import { createPrayerAction, type ActionState } from "@/actions/life-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ActionState = {};

export function PrayerForm() {
  const [state, formAction, isPending] = useActionState(createPrayerAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="flex items-start gap-2">
      <div className="flex-1">
        <Input name="name" placeholder="Add a prayer…" required />
        {state.error ? <p className="mt-1 text-xs text-danger">{state.error}</p> : null}
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}
