"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createBodyMetricAction } from "@/actions/health-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { todayStr } from "@/lib/date";

const initialState: ActionState = {};

export function WeightForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createBodyMetricAction, initialState);
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
            <Plus className="h-3.5 w-3.5" /> Log weight
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log weight</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="logged_at">Date</Label>
              <Input id="logged_at" name="logged_at" type="date" defaultValue={todayStr()} required {...fieldAria(state, "logged_at")} />
              <FieldError id="logged_at-error" message={state.fieldErrors?.logged_at} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight_lbs">Weight (lbs)</Label>
              <Input
                id="weight_lbs"
                name="weight_lbs"
                type="number"
                step="0.1"
                min="1"
                required
                {...fieldAria(state, "weight_lbs")}
              />
              <FieldError id="weight_lbs-error" message={state.fieldErrors?.weight_lbs} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body_fat_pct">Body fat % (optional)</Label>
            <Input
              id="body_fat_pct"
              name="body_fat_pct"
              type="number"
              step="0.1"
              min="0"
              max="100"
              {...fieldAria(state, "body_fat_pct")}
            />
            <FieldError id="body_fat_pct-error" message={state.fieldErrors?.body_fat_pct} />
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
