"use client";

import { useActionState, useRef, useEffect } from "react";
import { createActivityAction } from "@/actions/business-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: ActionState = {};

export function ActivityForm({ contactId }: { contactId: string }) {
  const [state, formAction, isPending] = useActionState(createActivityAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="contact_id" value={contactId} />
      <Select name="type" defaultValue="note">
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="note" label="Note">Note</SelectItem>
          <SelectItem value="call" label="Call">Call</SelectItem>
          <SelectItem value="email" label="Email">Email</SelectItem>
          <SelectItem value="meeting" label="Meeting">Meeting</SelectItem>
          <SelectItem value="other" label="Other">Other</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex-1">
        <Input name="notes" placeholder="Log an interaction…" className="h-7 text-xs" required {...fieldAria(state, "notes")} />
        <FieldError id="notes-error" message={state.fieldErrors?.notes} />
      </div>
      <Button type="submit" size="sm" variant="secondary" className="h-7 px-2 text-xs" disabled={isPending}>
        Log
      </Button>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
