"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { researchRunParamsSchema, savedLeadSearchSchema, CALL_OUTCOMES, CALL_OUTCOME_LABEL, type CallOutcome } from "@/lib/validations/lead-research";
import {
  createSavedLeadSearch,
  setSavedLeadSearchEnabled,
  deleteSavedLeadSearch,
  createResearchRun,
  getResearchRun,
  updateResearchRun,
  dismissLead,
} from "@/lib/db/queries/lead-research";
import { dispatchResearchRun } from "@/lib/research/dispatch";
import { refreshSingleLead } from "@/lib/research/refresh-single-lead";
import { actionStateFromZodError, type ActionState } from "@/lib/validation";

const LEADS_PATH = "/business/leads";

export async function createSavedLeadSearchAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = savedLeadSearchSchema.safeParse({
    label: formData.get("label"),
    keyword: formData.get("keyword"),
    city: formData.get("city"),
    region: formData.get("region"),
    country: formData.get("country"),
    radius_km: formData.get("radius_km"),
    min_reviews: formData.get("min_reviews"),
    max_reviews: formData.get("max_reviews"),
    must_have_website: formData.get("must_have_website"),
    max_results: formData.get("max_results"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);

  const supabase = await createClient();
  await createSavedLeadSearch(supabase, parsed.data);
  revalidatePath("/settings");
  return {};
}

export async function toggleSavedLeadSearchAction(id: string, enabled: boolean): Promise<void> {
  const supabase = await createClient();
  await setSavedLeadSearchEnabled(supabase, id, enabled);
  revalidatePath("/settings");
}

export async function deleteSavedLeadSearchAction(id: string): Promise<void> {
  const supabase = await createClient();
  await deleteSavedLeadSearch(supabase, id);
  revalidatePath("/settings");
}

// ==================================================== manual run (Business Pipeline Cockpit)

interface StartRunActionState extends ActionState {
  runId?: string;
}

/**
 * The Lead Research page's "start a run" form. This is the manual-trigger
 * path app/api/research/runs/route.ts's own comment pointed at: a Server
 * Action, not a fetch to that bearer-protected route (the browser has no
 * CRON_SECRET to send, and shouldn't need one — the page itself, gated by
 * the site's Basic Auth like every other route, is the authorization).
 */
export async function startResearchRunAction(_prevState: StartRunActionState, formData: FormData): Promise<StartRunActionState> {
  const parsed = researchRunParamsSchema.safeParse({
    keyword: formData.get("keyword"),
    city: formData.get("city"),
    region: formData.get("region"),
    country: formData.get("country"),
    radius_km: formData.get("radius_km"),
    min_reviews: formData.get("min_reviews"),
    max_reviews: formData.get("max_reviews"),
    must_have_website: formData.get("must_have_website") || "any",
    max_results: formData.get("max_results"),
    force_refresh: formData.get("force_refresh") === "on",
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);

  const supabase = await createClient();
  const run = await createResearchRun(supabase, parsed.data);
  dispatchResearchRun(run.id, parsed.data);
  return { runId: run.id };
}

/** Polled client-side by the run-progress panel while a run is in flight — see the comment on startResearchRunAction for why this is a Server Action and not the bearer-protected GET route. */
export async function getResearchRunStatusAction(runId: string) {
  const supabase = await createClient();
  return getResearchRun(supabase, runId);
}

/** Same reasoning as startResearchRunAction — the "Cancel run" button in the progress panel needs a non-bearer path. run-job.ts checks status between businesses, so a run in the audit/qualify loop stops within a few seconds of this. */
export async function cancelResearchRunAction(runId: string): Promise<void> {
  const supabase = await createClient();
  await updateResearchRun(supabase, runId, { status: "cancelled" });
}

/** Called once a run reaches a terminal status, to pull the new rows into the (server-rendered) results table without a hard reload. */
export async function refreshLeadsListAction(): Promise<void> {
  revalidatePath(LEADS_PATH);
}

// ==================================================== row actions

export async function dismissLeadAction(id: string): Promise<void> {
  const supabase = await createClient();
  await dismissLead(supabase, id);
  revalidatePath(LEADS_PATH);
}

/** Re-audits and re-qualifies one lead in place — see lib/research/refresh-single-lead.ts. Returns an error string on failure instead of throwing, so the row can show it inline rather than the whole page erroring. */
export async function forceRefreshLeadAction(id: string): Promise<{ error?: string }> {
  const result = await refreshSingleLead(id);
  revalidatePath(LEADS_PATH);
  if (!result.ok) return { error: result.error };
  return {};
}

/**
 * One-click "log call outcome" — writes an activities row from a fixed
 * outcome label (see CALL_OUTCOMES) so working the call list top-down
 * never requires leaving the Lead Research page for a form. contactId is
 * always present (every lead_research row has one); dealId can be null if
 * its deal was deleted independently, in which case the activity is
 * logged against the contact only.
 */
export async function logCallOutcomeAction(contactId: string, dealId: string | null, outcome: CallOutcome): Promise<{ error?: string }> {
  if (!CALL_OUTCOMES.includes(outcome)) return { error: "Unknown call outcome" };
  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({
    contact_id: contactId,
    deal_id: dealId,
    type: "call",
    notes: CALL_OUTCOME_LABEL[outcome],
  });
  if (error) return { error: error.message };
  revalidatePath(LEADS_PATH);
  revalidatePath("/business/clients");
  return {};
}
