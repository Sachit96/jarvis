import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ResearchRunParams } from "@/lib/validations/lead-research";

type Client = SupabaseClient<Database>;
export type ResearchRun = Database["public"]["Tables"]["research_runs"]["Row"];
export type LeadResearchRow = Database["public"]["Tables"]["lead_research"]["Row"];

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
