import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isMissingRelation } from "@/lib/db/missing-relation";

type Client = SupabaseClient<Database>;

/**
 * DB-backed rate limiter (Session 2, Phase 2) — not in-memory, since
 * Netlify's serverless functions don't reliably share memory across
 * invocations. Call BEFORE doing the real work; if it returns true, log
 * the event via recordRateLimitEvent AFTER the work succeeds (not before
 * — a failed call shouldn't count against the budget).
 *
 * Degrades to "never limited" if migration 0027 hasn't run yet — same
 * standing rule as every other new table this session: a missing rate
 * limiter should never be the reason a route breaks, only a defense that
 * silently isn't active yet.
 */
export async function isRateLimited(supabase: Client, route: string, maxPerWindow: number, windowMinutes: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await supabase
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("route", route)
    .gte("created_at", windowStart);
  if (error) {
    if (isMissingRelation(error)) return false;
    throw error;
  }
  return (count ?? 0) >= maxPerWindow;
}

export async function recordRateLimitEvent(supabase: Client, route: string): Promise<void> {
  // Errors here (including a missing table) are deliberately swallowed —
  // failing to log a rate-limit event must never fail the request whose
  // work already succeeded.
  await supabase.from("rate_limit_events").insert({ route });
}
