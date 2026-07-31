import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * True only until migration 0016 has been applied. PGRST205 = table not in
 * schema cache, PGRST202 = function not in schema cache — PostgREST uses a
 * different code for each, confirmed by actually calling the RPC against
 * this project before the migration existed (not assumed from the
 * memory_entries precedent, which is a table-only case).
 */
function isMissingUsageTracking(error: { code?: string } | null): boolean {
  return error?.code === "PGRST205" || error?.code === "PGRST202";
}

/** Read-only — for display (e.g. the voice HUD's remaining-budget row). Never call this to decide whether to make a request; use incrementGeminiUsage for that (see its own doc comment on why). */
export async function getGeminiUsageToday(supabase: Client): Promise<number> {
  const { data, error } = await supabase.from("gemini_usage").select("request_count").eq("usage_date", todayStr()).maybeSingle();
  if (error) {
    if (isMissingUsageTracking(error)) return 0;
    throw error;
  }
  return data?.request_count ?? 0;
}

/**
 * Atomically increments today's counter and returns the new total —
 * check-then-act in one round trip via the increment_gemini_usage RPC
 * (a single "on conflict do update ... returning" statement), not a
 * separate select-then-update, so concurrent callers (Voice Mode and a
 * lead-research background run at the same time) can't race each other
 * into an undercount.
 *
 * Returns 0 (never blocks a real call) if migration 0016 hasn't been run
 * yet — budget tracking is a safety net on top of working functionality,
 * not a prerequisite for it. Every other Gemini call in this app would
 * otherwise break the moment this file shipped and before the migration
 * ran, exactly the memory_entries regression from earlier in this project.
 */
export async function incrementGeminiUsage(supabase: Client): Promise<number> {
  const { data, error } = await supabase.rpc("increment_gemini_usage", { p_date: todayStr() });
  if (error) {
    if (isMissingUsageTracking(error)) return 0;
    throw error;
  }
  return data;
}
