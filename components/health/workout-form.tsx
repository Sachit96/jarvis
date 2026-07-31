"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createWorkoutAction } from "@/actions/health-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const initialState: ActionState = {};

function nowLocalDatetime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function WorkoutForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createWorkoutAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New session
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New training session</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="session_label">Session name</Label>
            <Input
              id="session_label"
              name="session_label"
              list="session-suggestions"
              placeholder="Home Session"
              defaultValue="Gym Session"
              required
              autoFocus
              {...fieldAria(state, "session_label")}
            />
            <FieldError id="session_label-error" message={state.fieldErrors?.session_label} />
            <datalist id="session-suggestions">
              <option value="Home Session" />
              <option value="Gym Session" />
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="started_at">Started at</Label>
            <Input
              id="started_at"
              name="started_at"
              type="datetime-local"
              defaultValue={nowLocalDatetime()}
              required
              {...fieldAria(state, "started_at")}
            />
            <FieldError id="started_at-error" message={state.fieldErrors?.started_at} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} {...fieldAria(state, "notes")} />
            <FieldError id="notes-error" message={state.fieldErrors?.notes} />
          </div>
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Starting…" : "Start session"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
