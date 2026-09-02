import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateResearchRun } from "@/lib/db/queries/lead-research";
import { hasValidBearerToken } from "@/lib/api-auth";

/** The job loop checks status between businesses — this is the whole "resume" story for v1: a cancelled run's completed leads are already saved. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasValidBearerToken(request, "CRON_SECRET")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = await createClient();
  await updateResearchRun(supabase, id, { status: "cancelled" });
  return NextResponse.json({ ok: true });
}
