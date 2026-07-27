"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createLeadAction, type ActionState } from "@/actions/business-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];

const initialState: ActionState = {};

export function LeadForm({ stages }: { stages: Stage[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createLeadAction, initialState);
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
            <Plus className="h-4 w-4" /> New lead
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact_person">Contact person</Label>
              <Input id="contact_person" name="contact_person" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company_name">Company</Label>
              <Input id="company_name" name="company_name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="value">Deal value</Label>
              <Input id="value" name="value" type="number" step="0.01" min="0" defaultValue="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stage_id">Starting stage</Label>
              <Select name="stage_id" defaultValue={stages[0]?.id}>
                <SelectTrigger id="stage_id" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
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
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={isPending || stages.length === 0}>
            {stages.length === 0 ? "Add a stage first" : isPending ? "Adding…" : "Add lead"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
