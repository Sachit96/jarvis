"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createHabitAction } from "@/actions/life-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const initialState: ActionState = {};

export function HabitForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createHabitAction, initialState);
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
            <Plus className="h-4 w-4" /> New habit
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New habit</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required autoFocus {...fieldAria(state, "name")} />
            <FieldError id="name-error" message={state.fieldErrors?.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="metric_type">Metric</Label>
            <Select name="metric_type" defaultValue="custom">
              <SelectTrigger id="metric_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sleep" label="Sleep">Sleep</SelectItem>
                <SelectItem value="focus" label="Focus">Focus</SelectItem>
                <SelectItem value="training" label="Training">Training</SelectItem>
                <SelectItem value="screen_time" label="Screen Time">Screen Time</SelectItem>
                <SelectItem value="consistency" label="Consistency">Consistency</SelectItem>
                <SelectItem value="no_g" label="No G">No G</SelectItem>
                <SelectItem value="custom" label="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <input type="hidden" name="kind" value="boolean" />
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Adding…" : "Add habit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
