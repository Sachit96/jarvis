import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDailyBrief, generateWeeklyReview } from "@/lib/ai/mentor-brief";

/**
 * Batch-generates the daily brief or weekly review for every user. Intended
 * to be hit by an external scheduler (Netlify Scheduled Function, GitHub
 * Actions cron, etc.) — authenticate with:
 *   Authorization: Bearer <CRON_SECRET>
 * and call as POST /api/mentor/run?kind=daily or ?kind=weekly.
 *
 * Uses the admin (service-role) client since there's no user session in a
 * scheduled context; every query is still explicitly scoped to one user_id
 * at a time as defense-in-depth, per the convention in lib/supabase/admin.ts.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kind = request.nextUrl.searchParams.get("kind");
  if (kind !== "daily" && kind !== "weekly") {
    return NextResponse.json({ error: "?kind must be 'daily' or 'weekly'" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profiles, error: profilesError } = await admin.from("profiles").select("id");
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const results: { userId: string; ok: boolean; message?: string }[] = [];
  for (const profile of profiles) {
    try {
      if (kind === "daily") {
        await generateDailyBrief(admin, profile.id);
      } else {
        await generateWeeklyReview(admin, profile.id);
      }
      results.push({ userId: profile.id, ok: true });
    } catch (err) {
      results.push({ userId: profile.id, ok: false, message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return NextResponse.json({
    kind,
    total: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
  });
}
