"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { upsertMarketAnalysisAction } from "@/actions/trading-actions";
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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function SentimentSelect({ name, label }: { name: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Select name={name} defaultValue="choppy">
        <SelectTrigger id={name} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="bullish" label="Bullish">Bullish</SelectItem>
          <SelectItem value="bearish" label="Bearish">Bearish</SelectItem>
          <SelectItem value="choppy" label="Choppy">Choppy</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function MarketAnalysisForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(upsertMarketAnalysisAction, initialState);
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
            <Plus className="h-4 w-4" /> New analysis
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Top-down analysis</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pair">Pair</Label>
              <Input id="pair" name="pair" placeholder="EURUSD" required autoFocus {...fieldAria(state, "pair")} />
              <FieldError id="pair-error" message={state.fieldErrors?.pair} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="analysis_date">Date</Label>
              <Input
                id="analysis_date"
                name="analysis_date"
                type="date"
                defaultValue={todayStr()}
                required
                {...fieldAria(state, "analysis_date")}
              />
              <FieldError id="analysis_date-error" message={state.fieldErrors?.analysis_date} />
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <SentimentSelect name="weekly_sentiment" label="Weekly sentiment" />
            <Textarea name="weekly_notes" rows={2} placeholder="Weekly structure notes…" {...fieldAria(state, "weekly_notes")} />
            <FieldError id="weekly_notes-error" message={state.fieldErrors?.weekly_notes} />
          </div>
          <div className="space-y-2 rounded-md border border-border p-3">
            <SentimentSelect name="daily_sentiment" label="Daily sentiment" />
            <Textarea name="daily_notes" rows={2} placeholder="Daily structure notes…" {...fieldAria(state, "daily_notes")} />
            <FieldError id="daily_notes-error" message={state.fieldErrors?.daily_notes} />
          </div>
          <div className="space-y-2 rounded-md border border-border p-3">
            <SentimentSelect name="h4_sentiment" label="4H sentiment" />
            <Textarea name="h4_notes" rows={2} placeholder="4H structure notes…" {...fieldAria(state, "h4_notes")} />
            <FieldError id="h4_notes-error" message={state.fieldErrors?.h4_notes} />
          </div>

          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Save analysis"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
