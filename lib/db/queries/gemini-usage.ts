import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isMissingRelation } from "@/lib/db/missing-relation";
import { todayStr } from "@/lib/date";

type Client = SupabaseClient<Database>;

export interface ModelUsage {
  model: string;
  requestCount: number;
}

/** Read-only — for display (e.g. the voice HUD's remaining-budget row). Never call this to decide whether to make a request; use incrementGeminiUsage for that (see its own doc comment on why). One row per model that's made at least one request today. */
export async function getGeminiUsageToday(supabase: Client): Promise<ModelUsage[]> {
  const { data, error } = await supabase.from("gemini_usage").select("model, request_count").eq("usage_date", todayStr());
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({ model: row.model, requestCount: row.request_count }));
}

/**
 * Atomically increments today's per-model counter and returns the new
 * total — check-then-act in one round trip via the increment_gemini_usage
 * RPC (a single "on conflict do update ... returning" statement), not a
 * separate select-then-update, so concurrent callers hitting the same
 * model (Voice Mode and a lead-research background run at the same time)
 * can't race each other into an undercount. Tracked per-model (migration
 * 0018) rather than one shared counter, since the two tiers have very
 * different, independently-enforced daily ceilings.
 *
 * Returns 0 (never blocks a real call) if the tracking migration hasn't
 * been run yet — budget tracking is a safety net on top of working
 * functionality, not a prerequisite for it.
 */
export async function incrementGeminiUsage(supabase: Client, model: string): Promise<number> {
  const { data, error } = await supabase.rpc("increment_gemini_usage", { p_date: todayStr(), p_model: model });
  if (error) {
    if (isMissingRelation(error)) return 0;
    throw error;
  }
  return data;
}
