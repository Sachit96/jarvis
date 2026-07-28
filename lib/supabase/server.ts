import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * JARVIS has no authentication — one fixed dataset, no sessions, no RLS.
 * Every Server Component/Action/Route Handler gets the same service-role
 * client. Kept async and named createClient() so every existing call site
 * (`const supabase = await createClient()`) needed zero changes.
 */
export async function createClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
