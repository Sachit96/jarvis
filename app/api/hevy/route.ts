import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncHevyWorkouts } from "@/lib/providers/workout/hevy-sync";
import { hasHevyKey } from "@/lib/providers/workout/hevy-client";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rate-limit";

const ROUTE = "hevy";
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MINUTES = 60;

/**
 * Gated by the site-wide Basic Auth proxy only (proxy.ts) — this route
 * used to also require Authorization: Bearer <CRON_SECRET> "for external/
 * scripted access," but nothing external ever actually called it that
 * way, and a request can only carry one Authorization header, so even a
 * hypothetical script would collide with a browser's Basic Auth on the
 * same origin. Unreachable-by-design, same bug class that broke Lead
 * Research and the mentor briefs (and recurred on /api/export/json).
 * Dropped rather than re-hardened, since this is a single-user app
 * already fully behind Basic Auth. If a real unattended/cron caller shows
 * up later, give it its own bearer-only route rather than gating this one
 * with both. HevyAutoSync and HevySyncButton both go through
 * syncHevyAction (actions/hevy-actions.ts) instead — a Server Action,
 * protected by Next.js's own same-origin check.
 */
export async function GET() {
  return NextResponse.json({ connected: hasHevyKey() });
}

export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  if (await isRateLimited(admin, ROUTE, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MINUTES)) {
    return NextResponse.json({ ok: false, message: "Rate limited — try again later" }, { status: 429 });
  }

  const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "10") || 10;

  try {
    const result = await syncHevyWorkouts(admin, pageSize);
    await recordRateLimitEvent(admin, ROUTE);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Hevy sync failed" },
      { status: 500 },
    );
  }
}
