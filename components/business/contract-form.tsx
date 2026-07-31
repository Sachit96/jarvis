"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createContractAction } from "@/actions/business-actions";
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
import type { Database } from "@/lib/supabase/database.types";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

const initialState: ActionState = {};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function ContractForm({ contacts }: { contacts: Contact[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createContractAction, initialState);
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
          <Button size="sm" className="gap-1.5" disabled={contacts.length === 0}>
            <Plus className="h-4 w-4" /> New contract
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New contract</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contact_id">Client</Label>
            <Select name="contact_id" defaultValue={contacts[0]?.id}>
              <SelectTrigger id="contact_id" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    label={c.company_name ? `${c.contact_person} — ${c.company_name}` : c.contact_person}
                  >
                    {c.contact_person}
                    {c.company_name ? ` — ${c.company_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="Monthly retainer" required autoFocus {...fieldAria(state, "title")} />
            <FieldError id="title-error" message={state.fieldErrors?.title} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="monthly_value">Monthly value</Label>
              <Input
                id="monthly_value"
                name="monthly_value"
                type="number"
                step="0.01"
                min="0"
                required
                {...fieldAria(state, "monthly_value")}
              />
              <FieldError id="monthly_value-error" message={state.fieldErrors?.monthly_value} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue="active">
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active" label="Active">Active</SelectItem>
                  <SelectItem value="paused" label="Paused">Paused</SelectItem>
                  <SelectItem value="completed" label="Completed">Completed</SelectItem>
                  <SelectItem value="cancelled" label="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={todayStr()}
                required
                {...fieldAria(state, "start_date")}
              />
              <FieldError id="start_date-error" message={state.fieldErrors?.start_date} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">End date</Label>
              <Input id="end_date" name="end_date" type="date" {...fieldAria(state, "end_date")} />
              <FieldError id="end_date-error" message={state.fieldErrors?.end_date} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} {...fieldAria(state, "notes")} />
            <FieldError id="notes-error" message={state.fieldErrors?.notes} />
          </div>
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Add contract"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
