import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role client for routes with no browser-facing request context
 * (cron/scheduler hits, webhooks) — functionally identical to
 * lib/supabase/server.ts's createClient() now that there's no session/RLS
 * distinction left, kept as a separate entry point for those call sites.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
