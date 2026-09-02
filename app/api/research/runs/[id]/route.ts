import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResearchRun } from "@/lib/db/queries/lead-research";
import { hasValidBearerToken } from "@/lib/api-auth";

/** No client panel actually calls this yet (see the parent route's comment) — bearer-protected for consistency with the rest of /api/research/runs*, not because a live poll loop currently needs an exception. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasValidBearerToken(request, "CRON_SECRET")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = await createClient();
  const run = await getResearchRun(supabase, id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  return NextResponse.json(run);
}
