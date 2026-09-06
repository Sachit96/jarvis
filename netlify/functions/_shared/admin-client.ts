import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../lib/supabase/database.types";

/**
 * A deliberate duplicate of lib/supabase/admin.ts's createAdminClient, not
 * a re-export of it. That file (and its whole guarded chain — see
 * netlify/functions/_shared/research/ for the deeper case) opens with
 * `import "server-only"`, whose real, unconditional implementation
 * (node_modules/server-only/index.js) is `throw new Error(...)` — it only
 * resolves to a no-op under Next.js's own "react-server" bundler
 * condition. Netlify's function bundler (esbuild, no such condition
 * configured anywhere in this project) crashes at module load the instant
 * anything imports that chain — found live (2026-09-06): this is why
 * scheduled_runs had never contained a single row, for any of the four
 * scheduled/background functions, since the day each was written. None of
 * their own try/catch or logging code was ever unreachable by a runtime
 * bug — the crash happens before any of it, at import time.
 *
 * Fix is duplication, not deletion: lib/supabase/admin.ts's guard is real
 * protection for the service-role key against ever landing in a client
 * bundle, and stays exactly as-is for app code. This file is the
 * Netlify-functions-only equivalent, same two env vars, same client
 * options, deliberately never importing the guarded original.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
