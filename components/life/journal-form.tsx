"use client";

import { useActionState, useRef, useEffect } from "react";
import { createJournalEntryAction, type ActionState } from "@/actions/life-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: ActionState = {};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function JournalForm() {
  const [state, formAction, isPending] = useActionState(createJournalEntryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="entry_date">Date</Label>
          <Input id="entry_date" name="entry_date" type="date" defaultValue={todayStr()} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="entry_type">Type</Label>
          <Select name="entry_type" defaultValue="reflection">
            <SelectTrigger id="entry_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reflection">Reflection</SelectItem>
              <SelectItem value="freeform">Freeform</SelectItem>
              <SelectItem value="gratitude">Gratitude</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="title">Title (optional)</Label>
        <Input id="title" name="title" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="body">Entry</Label>
        <Textarea id="body" name="body" rows={5} required placeholder="What's on your mind?" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mood">Mood (1-5, optional)</Label>
        <Select name="mood">
          <SelectTrigger id="mood" className="w-24">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save entry"}
      </Button>
    </form>
  );
}
