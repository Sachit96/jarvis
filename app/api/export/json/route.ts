import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildExportPayload } from "@/lib/export";
import { hasValidBearerToken } from "@/lib/api-auth";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rate-limit";

const ROUTE = "export/json";
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MINUTES = 60;

/**
 * Dumps ~30 tables including finances and health data. Previously
 * protected only by the site-wide Basic Auth gate (proxy.ts) — that
 * password gets resent by the browser automatically for every request to
 * the origin once entered, so anyone who ever got that far could hit this
 * URL directly and pull everything in one shot with no further friction.
 * Requires the same Authorization: Bearer <CRON_SECRET> as
 * /api/mentor/run now, as real defense-in-depth on top of that. The
 * Settings page's own "Export JSON backup" button goes through
 * exportJsonBackupAction (actions/export-actions.ts) instead of this
 * route — a Server Action, protected by Next.js's own same-origin check,
 * so the browser UI never needs the secret shipped to client code.
 */
export async function GET(request: NextRequest) {
  if (!hasValidBearerToken(request, "CRON_SECRET")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
