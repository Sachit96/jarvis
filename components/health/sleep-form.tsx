"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createSleepLogAction } from "@/actions/health-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const initialState: ActionState = {};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function SleepForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createSleepLogAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      setOpen(false);
      formRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="secondary" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Log sleep
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log sleep</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="log_date">Date</Label>
              <Input id="log_date" name="log_date" type="date" defaultValue={todayStr()} required {...fieldAria(state, "log_date")} />
              <FieldError id="log_date-error" message={state.fieldErrors?.log_date} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hours_slept">Hours slept</Label>
              <Input
                id="hours_slept"
                name="hours_slept"
                type="number"
                step="0.25"
                min="0"
                max="24"
                required
                {...fieldAria(state, "hours_slept")}
              />
              <FieldError id="hours_slept-error" message={state.fieldErrors?.hours_slept} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quality">Quality — 1 (poor) to 5 (great), optional</Label>
            <Input id="quality" name="quality" type="number" step="1" min="1" max="5" {...fieldAria(state, "quality")} />
            <FieldError id="quality-error" message={state.fieldErrors?.quality} />
          </div>
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
