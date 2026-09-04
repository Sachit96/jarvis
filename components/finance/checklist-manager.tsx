"use client";

import { useActionState, useRef, useEffect, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field-error";
import {
  createChecklistItemAction,
  deleteChecklistItemAction,
} from "@/actions/trading-actions";
import type { Database } from "@/lib/supabase/database.types";

type ChecklistItem = Database["public"]["Tables"]["trade_checklist_items"]["Row"];

const initialState: ActionState = {};

function ChecklistItemRow({ item }: { item: ChecklistItem }) {
  const [isPending, startTransition] = useTransition();
  return (
    <li className={cn("flex items-center justify-between gap-2 text-sm", isPending && "opacity-50")}>
      <span>{item.label}</span>
      <button
        onClick={() => startTransition(() => deleteChecklistItemAction(item.id))}
        aria-label="Delete checklist item"
        className="relative after:absolute after:-inset-3.5 text-muted-foreground hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

export function ChecklistManager({ items }: { items: ChecklistItem[] }) {
  const [state, formAction, isPending] = useActionState(createChecklistItemAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Pre-trade confluence checklist</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Every item here must be checked before you can log a new trade.
      </p>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {items.map((item) => (
            <ChecklistItemRow key={item.id} item={item} />
          ))}
        </ul>
      ) : null}
      <form ref={formRef} action={formAction} className="mt-3 flex items-center gap-2">
        <div className="flex-1">
          <Input name="label" placeholder="Add a checklist item…" {...fieldAria(state, "label")} />
          <FieldError id="label-error" message={state.fieldErrors?.label} />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={isPending} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </form>
      {state.error ? <p className="mt-1 text-xs text-danger">{state.error}</p> : null}
    </div>
  );
}
