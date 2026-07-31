import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * True only until the relevant migration has been applied. PGRST205 =
 * table not in schema cache, PGRST202 = function not in schema cache —
 * PostgREST uses a different code for each, confirmed by actually calling
 * the RPC against this project before the migration existed. 42703 = plain
 * Postgres "undefined_column" — confirmed live the moment this shipped
 * ahead of migration 0018 actually being applied: gemini_usage's table and
 * (old, 1-arg) function both still existed, so neither PGRST205 nor
 * PGRST202 fired, but selecting the not-yet-existent `model` column threw
 * this instead and crashed the whole /voice page (getVoiceDashboardData
 * has no try/catch of its own around this call) — a real production
 * incident, not a hypothetical one, which is why this third code is
 * checked explicitly rather than assumed sufficient without it.
 */
function isMissingUsageTracking(error: { code?: string } | null): boolean {
  return error?.code === "PGRST205" || error?.code === "PGRST202" || error?.code === "42703";
}

export interface ModelUsage {
  model: string;
  requestCount: number;
}

/** Read-only — for display (e.g. the voice HUD's remaining-budget row). Never call this to decide whether to make a request; use incrementGeminiUsage for that (see its own doc comment on why). One row per model that's made at least one request today. */
export async function getGeminiUsageToday(supabase: Client): Promise<ModelUsage[]> {
  const { data, error } = await supabase.from("gemini_usage").select("model, request_count").eq("usage_date", todayStr());
  if (error) {
    if (isMissingUsageTracking(error)) return [];
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
    if (isMissingUsageTracking(error)) return 0;
    throw error;
  }
  return data;
}
