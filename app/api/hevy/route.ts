import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncHevyWorkouts } from "@/lib/providers/workout/hevy-sync";
import { hasHevyKey } from "@/lib/providers/workout/hevy-client";
import { hasValidBearerToken } from "@/lib/api-auth";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rate-limit";

const ROUTE = "hevy";
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MINUTES = 60;

/**
 * Bearer-protected for external/scripted access, same
 * Authorization: Bearer <CRON_SECRET> as /api/mentor/run and
 * /api/export/json — the browser UI never calls this route directly
 * anymore; HevyAutoSync and HevySyncButton both go through
 * syncHevyAction (actions/hevy-actions.ts) instead, a Server Action
 * protected by Next.js's own same-origin check.
 */
export async function GET(request: NextRequest) {
  if (!hasValidBearerToken(request, "CRON_SECRET")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ connected: hasHevyKey() });
}

export async function POST(request: NextRequest) {
  if (!hasValidBearerToken(request, "CRON_SECRET")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
