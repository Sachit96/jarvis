"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createGoalAction } from "@/actions/life-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/textarea";
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

export function GoalForm({ defaultTimeframe }: { defaultTimeframe: "daily" | "weekly" | "monthly" }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createGoalAction, initialState);
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
            <Plus className="h-4 w-4" /> New goal
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required autoFocus {...fieldAria(state, "title")} />
            <FieldError id="title-error" message={state.fieldErrors?.title} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} {...fieldAria(state, "description")} />
            <FieldError id="description-error" message={state.fieldErrors?.description} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="timeframe">Timeframe</Label>
              <Select name="timeframe" defaultValue={defaultTimeframe}>
                <SelectTrigger id="timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily" label="Daily">Daily</SelectItem>
                  <SelectItem value="weekly" label="Weekly">Weekly</SelectItem>
                  <SelectItem value="monthly" label="Monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target_date">Target date</Label>
              <Input id="target_date" name="target_date" type="date" {...fieldAria(state, "target_date")} />
              <FieldError id="target_date-error" message={state.fieldErrors?.target_date} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" placeholder="Business, Health, Mind…" {...fieldAria(state, "category")} />
            <FieldError id="category-error" message={state.fieldErrors?.category} />
          </div>
          <input type="hidden" name="progress_percent" value="0" />
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Adding…" : "Add goal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
