import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type DealRow = Database["public"]["Tables"]["deals"]["Row"];
type ContractRow = Database["public"]["Tables"]["contracts"]["Row"];
type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];

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

/** Single contact — the /business/clients/[id] detail page. Null means "not found," not an error, so the page can render a 404 rather than crash. */
export async function getContact(supabase: Client, id: string) {
  const { data, error } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
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

/** Single deal — the /business/pipeline/[id] detail page. */
export async function getDeal(supabase: Client, id: string) {
  const { data, error } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDealsForContact(supabase: Client, contactId: string) {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("contact_id", contactId)
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

/** Deal-scoped activity timeline — the /business/pipeline/[id] detail page. Distinct from getActivitiesForContact: a contact can have several deals, and a deal's own page should show only its own interactions, not every activity ever logged against the contact. */
export async function getActivitiesForDeal(supabase: Client, dealId: string) {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("deal_id", dealId)
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

/** Contact-scoped — the /business/clients/[id] detail page's own contracts section, distinct from the all-contracts list on /business/revenue. */
export async function getContractsForContact(supabase: Client, contactId: string) {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("contact_id", contactId)
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


// ==================================================== follow-up watchdog (B3)

const STALE_THRESHOLD_DAYS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface StaleDeal {
  dealId: string;
  label: string;
  daysSinceStageChange: number;
}

/**
 * Deals sitting in the same stage for STALE_THRESHOLD_DAYS+ — won/lost
 * deals are excluded, since a closed deal isn't "gone quiet," it's just
 * done. Pure function over already-fetched arrays (same convention as
 * computeMrr/computeAssetLiabilityTotals elsewhere in this codebase), not
 * its own query — context-builder.ts already fetches deals/stages/contacts
 * for other reasons, so this reuses them rather than re-querying.
 */
export function computeStaleDeals(
  deals: Pick<DealRow, "id" | "title" | "stage_id" | "stage_changed_at" | "contact_id">[],
  stages: Pick<PipelineStageRow, "id" | "is_won" | "is_lost">[],
  contacts: Pick<ContactRow, "id" | "contact_person" | "company_name">[],
  thresholdDays: number = STALE_THRESHOLD_DAYS,
): StaleDeal[] {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const cutoffMs = Date.now() - thresholdDays * MS_PER_DAY;

  return deals
    .filter((d) => {
      const stage = stageById.get(d.stage_id);
      if (!stage || stage.is_won || stage.is_lost) return false;
      return new Date(d.stage_changed_at).getTime() < cutoffMs;
    })
    .map((d) => {
      const contact = contactById.get(d.contact_id);
      const label = contact?.company_name || contact?.contact_person || d.title || "Untitled deal";
      return {
        dealId: d.id,
        label,
        daysSinceStageChange: Math.floor((Date.now() - new Date(d.stage_changed_at).getTime()) / MS_PER_DAY),
      };
    });
}

export interface StaleContact {
  contactId: string;
  label: string;
  daysSinceLastActivity: number;
}

/** Contacts with no logged activity in STALE_THRESHOLD_DAYS+ (measured from account creation if they've never had one at all). Pure function, same convention as computeStaleDeals above. */
export function computeStaleContacts(
  contacts: Pick<ContactRow, "id" | "contact_person" | "company_name" | "created_at">[],
  activities: Pick<ActivityRow, "contact_id" | "occurred_at">[],
  thresholdDays: number = STALE_THRESHOLD_DAYS,
): StaleContact[] {
  const lastActivityByContact = new Map<string, string>();
  for (const a of activities) {
    const existing = lastActivityByContact.get(a.contact_id);
    if (!existing || a.occurred_at > existing) lastActivityByContact.set(a.contact_id, a.occurred_at);
  }

  return contacts
    .map((c) => {
      const referenceIso = lastActivityByContact.get(c.id) ?? c.created_at;
      return {
        contactId: c.id,
        label: c.company_name || c.contact_person,
        daysSinceLastActivity: Math.floor((Date.now() - new Date(referenceIso).getTime()) / MS_PER_DAY),
      };
    })
    .filter((c) => c.daysSinceLastActivity >= thresholdDays);
}
