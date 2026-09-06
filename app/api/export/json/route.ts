import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildExportPayload } from "@/lib/export";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rate-limit";

const ROUTE = "export/json";
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MINUTES = 60;

/**
 * Dumps ~30 tables including finances and health data. Gated by the
 * site-wide Basic Auth proxy only (proxy.ts) — this route used to also
 * require Authorization: Bearer <CRON_SECRET> "as defense-in-depth," but
 * a request can only carry one Authorization header, so a browser (Basic)
 * could never satisfy the route's own check (Bearer), and nothing external
 * ever called this with a bearer token either. The route was unreachable
 * by any real caller, same bug class that broke Lead Research and the
 * mentor briefs. Since this is a single-user app already fully behind
 * Basic Auth (nothing here is more sensitive than the finance/health pages
 * that same password already protects), the redundant Bearer check is
 * dropped rather than re-hardened — there is no genuine unattended/cron
 * caller for this route today. If one is ever added, give it its own
 * bearer-only route rather than gating this one with both. The Settings
 * page's own "Export JSON backup" button goes through
 * exportJsonBackupAction (actions/export-actions.ts) instead of this
 * route — a Server Action, protected by Next.js's own same-origin check.
 */
export async function GET() {
  const supabase = createAdminClient();
  if (await isRateLimited(supabase, ROUTE, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MINUTES)) {
    return NextResponse.json({ error: "Rate limited — try again later" }, { status: 429 });
  }

  const payload = await buildExportPayload(supabase);
  await recordRateLimitEvent(supabase, ROUTE);

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="jarvis-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
