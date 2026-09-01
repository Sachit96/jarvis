"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createScheduleBlockAction } from "@/actions/uni-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { SCHEDULE_BLOCK_TYPES } from "@/lib/validations/uni";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const TYPE_LABEL: Record<(typeof SCHEDULE_BLOCK_TYPES)[number], string> = {
  lecture: "Lecture",
  tutorial: "Tutorial",
  lab: "Lab",
  office_hours: "Office hours",
};

const DAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const initialState: ActionState = {};

export function ScheduleBlockForm({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createScheduleBlockAction, initialState);
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
            <Plus className="h-3.5 w-3.5" /> Add class time
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add class time</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="course_id" value={courseId} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue="lecture">
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_BLOCK_TYPES.map((t) => (
                    <SelectItem key={t} value={t} label={TYPE_LABEL[t]}>
                      {TYPE_LABEL[t]}
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
            <Label htmlFor="room">Room</Label>
            <Input id="room" name="room" />
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
