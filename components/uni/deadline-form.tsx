"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createDeadlineAction } from "@/actions/uni-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { DEADLINE_CATEGORIES } from "@/lib/validations/uni";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const CATEGORY_LABEL: Record<(typeof DEADLINE_CATEGORIES)[number], string> = {
  enrolment: "Enrolment",
  withdrawal: "Withdrawal",
  tuition: "Tuition",
  osap: "OSAP",
  exam_period: "Exam period",
  break: "Break",
  other: "Other",
};

const initialState: ActionState = {};

export function DeadlineForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createDeadlineAction, initialState);
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
            <Plus className="h-4 w-4" /> New deadline
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New university deadline</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="Course withdrawal deadline" required autoFocus {...fieldAria(state, "title")} />
            <FieldError id="title-error" message={state.fieldErrors?.title} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="due_at">Due</Label>
              <Input id="due_at" name="due_at" type="datetime-local" required {...fieldAria(state, "due_at")} />
              <FieldError id="due_at-error" message={state.fieldErrors?.due_at} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select name="category" defaultValue="other">
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEADLINE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} label={CATEGORY_LABEL[c]}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Adding…" : "Add deadline"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
