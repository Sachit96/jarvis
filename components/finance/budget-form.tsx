"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createBudgetAction, type ActionState } from "@/actions/finance-actions";
import { SUGGESTED_CATEGORIES } from "@/lib/validations/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const initialState: ActionState = {};

export function BudgetForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createBudgetAction, initialState);
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
            <Plus className="h-4 w-4" /> New budget
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Monthly budget cap</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" list="category-suggestions" required autoFocus />
            <datalist id="category-suggestions">
              {SUGGESTED_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Matches transactions with this exact category. Setting a budget for an existing
              category updates its limit.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monthly_limit">Monthly limit</Label>
            <Input id="monthly_limit" name="monthly_limit" type="number" step="0.01" min="0.01" required />
          </div>
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Save budget"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
