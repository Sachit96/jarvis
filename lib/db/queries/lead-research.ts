import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ResearchRunParams, SavedLeadSearchInput } from "@/lib/validations/lead-research";
import { isMissingRelation } from "@/lib/db/missing-relation";

type Client = SupabaseClient<Database>;
export type ResearchRun = Database["public"]["Tables"]["research_runs"]["Row"];
export type LeadResearchRow = Database["public"]["Tables"]["lead_research"]["Row"];
export type SavedLeadSearch = Database["public"]["Tables"]["saved_lead_searches"]["Row"];

const CACHE_WINDOW_DAYS = 30;

export async function createResearchRun(supabase: Client, params: ResearchRunParams): Promise<ResearchRun> {
  const { data, error } = await supabase
    .from("research_runs")
    .insert({ params: params as unknown as Database["public"]["Tables"]["research_runs"]["Insert"]["params"], status: "queued" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getResearchRun(supabase: Client, id: string): Promise<ResearchRun | null> {
  const { data, error } = await supabase.from("research_runs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateResearchRun(supabase: Client, id: string, patch: Partial<Database["public"]["Tables"]["research_runs"]["Update"]>) {
  const { error } = await supabase.from("research_runs").update(patch).eq("id", id);
  if (error) throw error;
}

/** Cheap poll target for the cancel button — just the status column, not the whole row. */
export async function getResearchRunStatus(supabase: Client, id: string): Promise<string | null> {
  const { data, error } = await supabase.from("research_runs").select("status").eq("id", id).maybeSingle();
  if (error) throw error;
  return data?.status ?? null;
}

/** Dedupe check — null means "never researched", so the caller always proceeds in that case. */
export async function getLeadResearchByPlaceId(supabase: Client, googlePlaceId: string): Promise<LeadResearchRow | null> {
  const { data, error } = await supabase.from("lead_research").select("*").eq("google_place_id", googlePlaceId).maybeSingle();
  if (error) throw error;
  return data;
}

export function isCached(row: LeadResearchRow, forceRefresh: boolean): boolean {
  if (forceRefresh) return false;
  const ageMs = Date.now() - new Date(row.researched_at).getTime();
  return ageMs < CACHE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export async function getResearchLeads(supabase: Client) {
  const { data, error } = await supabase
    .from("lead_research")
    .select("*, contacts(*), deals(*)")
    .eq("dismissed", false)
    .order("score", { ascending: false });
  if (error) throw error;
  return data;
}

// ==================================================== saved (recurring) search

/** Returns [] (never throws/blocks the Settings page) if migration 0019 hasn't been run yet — see lib/db/missing-relation.ts. */
export async function getSavedLeadSearches(supabase: Client): Promise<SavedLeadSearch[]> {
  const { data, error } = await supabase.from("saved_lead_searches").select("*").order("created_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

export async function createSavedLeadSearch(supabase: Client, input: SavedLeadSearchInput): Promise<SavedLeadSearch> {
  const { label, ...params } = input;
  const { data, error } = await supabase
    .from("saved_lead_searches")
    .insert({ label, params: params as unknown as Database["public"]["Tables"]["saved_lead_searches"]["Insert"]["params"] })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setSavedLeadSearchEnabled(supabase: Client, id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from("saved_lead_searches").update({ enabled }).eq("id", id);
  if (error) throw error;
}

export async function deleteSavedLeadSearch(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("saved_lead_searches").delete().eq("id", id);
  if (error) throw error;
}

/** Enabled, and either never run or not run in the last 7 days — the actual enforcement of the weekly cadence, not just a side effect of the scheduled function only firing once a week (schedule drift, a manual re-invoke, etc. shouldn't be able to re-run a search early). Returns [] if migration 0019 hasn't been run yet, same as getSavedLeadSearches. */
export async function getDueSavedLeadSearches(supabase: Client): Promise<SavedLeadSearch[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("saved_lead_searches")
    .select("*")
    .eq("enabled", true)
    .or(`last_run_at.is.null,last_run_at.lt.${sevenDaysAgo}`);
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

export async function markSavedLeadSearchRun(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("saved_lead_searches").update({ last_run_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
