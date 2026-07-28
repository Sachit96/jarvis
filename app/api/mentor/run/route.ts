import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDailyBrief, generateWeeklyReview } from "@/lib/ai/mentor-brief";

/**
 * Generates the daily brief or weekly review. Intended to be hit by an
 * external scheduler (Netlify Scheduled Function, GitHub Actions cron,
 * etc.) — authenticate with:
 *   Authorization: Bearer <CRON_SECRET>
 * and call as POST /api/mentor/run?kind=daily or ?kind=weekly.
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
  try {
    if (kind === "daily") {
      await generateDailyBrief(admin);
    } else {
      await generateWeeklyReview(admin);
    }
    return NextResponse.json({ kind, ok: true });
  } catch (err) {
    return NextResponse.json(
      { kind, ok: false, message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
