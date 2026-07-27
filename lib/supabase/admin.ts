import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. Use ONLY from trusted
 * server-only contexts with no user session (e.g. the Netlify Scheduled
 * Function that triggers the AI Mentor for every user). Every query run
 * through this client must still explicitly filter by user_id as
 * defense-in-depth, since RLS won't do it here.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
