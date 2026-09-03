"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2 } from "lucide-react";
import { startResearchRunAction, getResearchRunStatusAction, cancelResearchRunAction } from "@/actions/lead-research-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Database } from "@/lib/supabase/database.types";

type ResearchRun = Database["public"]["Tables"]["research_runs"]["Row"];

interface StartRunState extends ActionState {
  runId?: string;
}

const initialState: StartRunState = {};
const POLL_MS = 2000;
const TERMINAL_STATUSES = new Set(["done", "failed", "cancelled"]);

/** The run-progress panel — polls getResearchRunStatusAction every 2s while a run is queued/running, then stops and refreshes the results table once it reaches a terminal status. See lib/research/dispatch.ts for how the run actually gets kicked off. */
function RunProgress({ runId, onDone }: { runId: string; onDone: () => void }) {
  const [run, setRun] = useState<ResearchRun | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const result = await getResearchRunStatusAction(runId);
      if (cancelled) return;
      setRun(result);
      if (result && TERMINAL_STATUSES.has(result.status)) {
        router.refresh();
        return;
      }
      if (!cancelled) setTimeout(poll, POLL_MS);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [runId, router]);

  if (!run) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting…
      </p>
    );
  }

  const isTerminal = TERMINAL_STATUSES.has(run.status);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium capitalize">
          {isTerminal ? run.status : (run.current_label ?? "Working…")}
        </p>
        {!isTerminal ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
        <div>
          <p className="text-muted-foreground">Found</p>
          <p className="tabular-nums">{run.found_count}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Audited</p>
          <p className="tabular-nums">{run.audited_count}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Added</p>
          <p className="tabular-nums">{run.inserted_count}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Failed</p>
          <p className="tabular-nums">{run.failed_count}</p>
        </div>
      </div>
      {run.status === "failed" && run.error_log ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {JSON.stringify(run.error_log).slice(0, 300)}
        </p>
      ) : null}
      <div className="flex gap-2 pt-1">
        {!isTerminal ? (
          <Button type="button" size="sm" variant="outline" onClick={() => cancelResearchRunAction(runId)}>
            Cancel run
          </Button>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={onDone}>
            Close
          </Button>
        )}
      </div>
    </div>
  );
}

export function StartRunForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(startResearchRunAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) formRef.current?.reset();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5">
            <Play className="h-4 w-4" /> Start a run
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a research run</DialogTitle>
        </DialogHeader>

        {state.runId ? (
          <RunProgress runId={state.runId} onDone={() => setOpen(false)} />
        ) : (
          <form ref={formRef} action={formAction} className="space-y-3">
            <div>
              <Label htmlFor="keyword">Business type / keyword</Label>
              <Input id="keyword" name="keyword" placeholder="roofing companies" required {...fieldAria(state, "keyword")} />
              <FieldError id="keyword-error" message={state.fieldErrors?.keyword} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" required {...fieldAria(state, "city")} />
                <FieldError id="city-error" message={state.fieldErrors?.city} />
              </div>
              <div>
                <Label htmlFor="region">Region / state</Label>
                <Input id="region" name="region" {...fieldAria(state, "region")} />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" name="country" required {...fieldAria(state, "country")} />
                <FieldError id="country-error" message={state.fieldErrors?.country} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="radius_km">Radius (km)</Label>
                <Input id="radius_km" name="radius_km" type="number" min="1" max="200" defaultValue="25" {...fieldAria(state, "radius_km")} />
              </div>
              <div>
                <Label htmlFor="max_results">Max results</Label>
                <Input id="max_results" name="max_results" type="number" min="1" max="25" defaultValue="10" {...fieldAria(state, "max_results")} />
              </div>
              <div>
                <Label htmlFor="must_have_website">Website</Label>
                <Select name="must_have_website" defaultValue="any">
                  <SelectTrigger id="must_have_website" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any" label="Any">Any</SelectItem>
                    <SelectItem value="yes" label="Has one">Has one</SelectItem>
                    <SelectItem value="no" label="None">None — strongest signal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="min_reviews">Min reviews</Label>
                <Input id="min_reviews" name="min_reviews" type="number" min="0" {...fieldAria(state, "min_reviews")} />
              </div>
              <div>
                <Label htmlFor="max_reviews">Max reviews</Label>
                <Input id="max_reviews" name="max_reviews" type="number" min="0" {...fieldAria(state, "max_reviews")} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="force_refresh" className="h-3.5 w-3.5 rounded border-border" />
              Re-check businesses already researched in the last 30 days
            </label>
            {state.error ? <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Starting…" : "Start run"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
