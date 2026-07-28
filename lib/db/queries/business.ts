import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type DealRow = Database["public"]["Tables"]["deals"]["Row"];
type ContractRow = Database["public"]["Tables"]["contracts"]["Row"];
type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];

export async function getPipelineStages(supabase: Client) {
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getContacts(supabase: Client) {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getDeals(supabase: Client) {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getDealTasks(supabase: Client, dealIds: string[]) {
  if (dealIds.length === 0) return [];
  const { data, error } = await supabase
    .from("deal_tasks")
    .select("*")
    .in("deal_id", dealIds)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function getActivitiesForContact(supabase: Client, contactId: string) {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAllActivities(supabase: Client) {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getContracts(supabase: Client) {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .order("status", { ascending: true })
    .order("start_date", { ascending: false });
  if (error) throw error;
  return data;
}

export function computeMrr(contracts: Pick<ContractRow, "status" | "monthly_value">[]) {
  return contracts
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + Number(c.monthly_value), 0);
}

export async function getOnboardingTasksForContact(supabase: Client, contactId: string) {
  const { data, error } = await supabase
    .from("client_onboarding_tasks")
    .select("*")
    .eq("contact_id", contactId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getAllOnboardingTasks(supabase: Client) {
  const { data, error } = await supabase
    .from("client_onboarding_tasks")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export function computePipelineValueByStage(deals: Pick<DealRow, "stage_id" | "value">[]) {
  const map = new Map<string, number>();
  for (const d of deals) {
    map.set(d.stage_id, (map.get(d.stage_id) ?? 0) + Number(d.value));
  }
  return map;
}

/** Shared by the Business dashboard and the Home command-center snapshot — one place for "open vs won vs win rate" math. */
export function computePipelineSummary(
  deals: Pick<DealRow, "stage_id" | "value">[],
  stages: Pick<PipelineStageRow, "id" | "is_won" | "is_lost">[],
) {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const openDeals = deals.filter((d) => {
    const stage = stageById.get(d.stage_id);
    return stage && !stage.is_won && !stage.is_lost;
  });
  const wonDeals = deals.filter((d) => stageById.get(d.stage_id)?.is_won);
  const lostDeals = deals.filter((d) => stageById.get(d.stage_id)?.is_lost);
  const closedCount = wonDeals.length + lostDeals.length;
  return {
    openCount: openDeals.length,
    openValue: openDeals.reduce((sum, d) => sum + Number(d.value), 0),
    wonCount: wonDeals.length,
    wonValue: wonDeals.reduce((sum, d) => sum + Number(d.value), 0),
    winRate: closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0,
    closedCount,
  };
}

export async function getGhlConnection(supabase: Client) {
  const { data, error } = await supabase.from("ghl_connections").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function getGhlSyncLogs(supabase: Client, limit = 20) {
  const { data, error } = await supabase
    .from("ghl_sync_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
