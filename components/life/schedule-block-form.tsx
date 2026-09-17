"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createLifeScheduleBlockAction } from "@/actions/life-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { LIFE_SCHEDULE_CATEGORIES } from "@/lib/validations/life";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const CATEGORY_LABEL: Record<(typeof LIFE_SCHEDULE_CATEGORIES)[number], string> = {
  self_care: "Self-care",
  commute: "Commute",
  deep_work: "On Radar",
  gym: "Gym",
  meal: "Meal",
  personal: "Personal",
};

const DAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const initialState: ActionState = {};

/**
 * Adds a block to the standing weekly routine (life_schedule_blocks). Class
 * times are not editable here — they stay owned by University's own
 * schedule-block form, so there is exactly one place to change a class time
 * rather than two that could disagree.
 */
export function LifeScheduleBlockForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createLifeScheduleBlockAction, initialState);
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
          <Button size="sm" variant="secondary" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add block
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to your routine</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="label">Label</Label>
            <Input id="label" name="label" required {...fieldAria(state, "label")} />
            <FieldError id="label-error" message={state.fieldErrors?.label} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select name="category" defaultValue="personal">
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFE_SCHEDULE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} label={CATEGORY_LABEL[c]}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="day_of_week">Day</Label>
              <Select name="day_of_week" defaultValue="1">
                <SelectTrigger id="day_of_week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_LABEL.map((label, i) => (
                    <SelectItem key={i} value={String(i)} label={label}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_time">Start</Label>
              <Input id="start_time" name="start_time" type="time" required {...fieldAria(state, "start_time")} />
              <FieldError id="start_time-error" message={state.fieldErrors?.start_time} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_time">End</Label>
              <Input id="end_time" name="end_time" type="time" required {...fieldAria(state, "end_time")} />
              <FieldError id="end_time-error" message={state.fieldErrors?.end_time} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" />
          </div>
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Adding…" : "Add"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
