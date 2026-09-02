import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * JARVIS has no authentication — one fixed dataset, no sessions, no RLS.
 * Every Server Component/Action/Route Handler gets the same service-role
 * client. Kept async and named createClient() so every existing call site
 * (`const supabase = await createClient()`) needed zero changes.
 *
 * Consolidated (Session 2, Phase 4) onto lib/supabase/admin.ts's
 * createAdminClient() as the single real client construction — this was
 * previously its own identical `createSupabaseClient(...)` call, just
 * wrapped in an unnecessary Promise. Both exports are kept (65 call sites
 * use one name or the other) so nothing else in the app needed to change.
 */
export async function createClient() {
  return createAdminClient();
}
