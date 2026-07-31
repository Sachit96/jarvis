"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createBudgetAction } from "@/actions/finance-actions";
import { SUGGESTED_CATEGORIES } from "@/lib/constants/finance";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
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
            <Input id="category" name="category" list="category-suggestions" required autoFocus {...fieldAria(state, "category")} />
            <datalist id="category-suggestions">
              {SUGGESTED_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <FieldError id="category-error" message={state.fieldErrors?.category} />
            <p className="text-xs text-muted-foreground">
              Matches transactions with this exact category. Setting a budget for an existing
              category updates its limit.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monthly_limit">Monthly limit</Label>
            <Input
              id="monthly_limit"
              name="monthly_limit"
              type="number"
              step="0.01"
              min="0.01"
              required
              {...fieldAria(state, "monthly_limit")}
            />
            <FieldError id="monthly_limit-error" message={state.fieldErrors?.monthly_limit} />
          </div>
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Save budget"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
