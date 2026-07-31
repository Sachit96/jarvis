"use client";

import { useActionState, useRef, useEffect, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { fieldAria, type ActionState } from "@/lib/validation";
import { timeAgo } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createSavedLeadSearchAction,
  toggleSavedLeadSearchAction,
  deleteSavedLeadSearchAction,
} from "@/actions/lead-research-actions";
import type { SavedLeadSearch } from "@/lib/db/queries/lead-research";

const initialState: ActionState = {};

function SavedSearchRow({ search }: { search: SavedLeadSearch }) {
  const [isTogglePending, startToggle] = useTransition();
  const [isDeletePending, startDelete] = useTransition();
  const params = search.params as { keyword?: string; city?: string; country?: string; max_results?: number };

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{search.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {params.keyword} in {params.city}, {params.country} · max {params.max_results ?? 10} · weekly
        </p>
        <p className="text-xs text-muted-foreground">
          {search.last_run_at ? `Last run ${timeAgo(search.last_run_at)}` : "Never run yet"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Switch
          checked={search.enabled}
          disabled={isTogglePending}
          onCheckedChange={(checked) => startToggle(() => toggleSavedLeadSearchAction(search.id, checked))}
        />
        <Button
          size="icon"
          variant="ghost"
          disabled={isDeletePending}
          onClick={() => startDelete(() => deleteSavedLeadSearchAction(search.id))}
          aria-label={`Delete ${search.label}`}
        >
          <Trash2 className="h-3.5 w-3.5 text-danger" />
        </Button>
      </div>
    </div>
  );
}

export function SavedLeadSearchesCard({ searches }: { searches: SavedLeadSearch[] }) {
  const [showForm, setShowForm] = useState(searches.length === 0);
  const [state, formAction, isPending] = useActionState(createSavedLeadSearchAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      setShowForm(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Recurring Lead Research</p>
        {!showForm ? (
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> New saved search
          </Button>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        A saved search re-runs automatically every Monday morning (already-qualified businesses are skipped as cached,
        not re-audited — max 25 businesses per run, hard-capped).
      </p>

      {searches.length > 0 ? (
        <div className="mt-3 space-y-2">
          {searches.map((s) => (
            <SavedSearchRow key={s.id} search={s} />
          ))}
        </div>
      ) : !showForm ? (
        <p className="mt-3 text-xs text-muted-foreground">No saved searches yet.</p>
      ) : null}

      {showForm ? (
        <form ref={formRef} action={formAction} className="mt-3 space-y-3 border-t border-border/60 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="label">Name</Label>
            <Input id="label" name="label" placeholder="e.g. Toronto roofers" required autoFocus {...fieldAria(state, "label")} />
            <FieldError id="label-error" message={state.fieldErrors?.label} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="keyword">Keyword</Label>
              <Input id="keyword" name="keyword" placeholder="roofing contractor" required {...fieldAria(state, "keyword")} />
              <FieldError id="keyword-error" message={state.fieldErrors?.keyword} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" required {...fieldAria(state, "city")} />
              <FieldError id="city-error" message={state.fieldErrors?.city} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="region">Region</Label>
              <Input id="region" name="region" {...fieldAria(state, "region")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" required {...fieldAria(state, "country")} />
              <FieldError id="country-error" message={state.fieldErrors?.country} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="radius_km">Radius (km)</Label>
              <Input id="radius_km" name="radius_km" type="number" min="1" max="200" defaultValue="25" {...fieldAria(state, "radius_km")} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="must_have_website">Website</Label>
              <Select name="must_have_website" defaultValue="any">
                <SelectTrigger id="must_have_website" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any" label="Any">Any</SelectItem>
                  <SelectItem value="yes" label="Has website">Has website</SelectItem>
                  <SelectItem value="no" label="No website">No website</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min_reviews">Min reviews</Label>
              <Input id="min_reviews" name="min_reviews" type="number" min="0" {...fieldAria(state, "min_reviews")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max_results">Max results (≤25)</Label>
              <Input id="max_results" name="max_results" type="number" min="1" max="25" defaultValue="10" {...fieldAria(state, "max_results")} />
              <FieldError id="max_results-error" message={state.fieldErrors?.max_results} />
            </div>
          </div>
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{state.error}</p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Saving…" : "Save search"}
            </Button>
            {searches.length > 0 ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
