import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncHevyWorkouts } from "@/lib/providers/workout/hevy-sync";
import { hasHevyKey } from "@/lib/providers/workout/hevy-client";

/** GET reports connection status; POST triggers a sync. */
export async function GET() {
  return NextResponse.json({ connected: hasHevyKey() });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const pageSize = Number(new URL(request.url).searchParams.get("pageSize") ?? "10") || 10;

  try {
    const result = await syncHevyWorkouts(supabase, pageSize);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Hevy sync failed" },
      { status: 500 },
    );
  }
}
