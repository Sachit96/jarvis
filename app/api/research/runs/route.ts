import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createResearchRun } from "@/lib/db/queries/lead-research";
import { researchRunParamsSchema } from "@/lib/validations/lead-research";
import { dispatchResearchRun } from "@/lib/research/dispatch";
import { hasValidBearerToken } from "@/lib/api-auth";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rate-limit";

const ROUTE = "research/runs";
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MINUTES = 60;

/**
 * Starts a research run and returns immediately with its id — the actual
 * work never happens inline in this request (see lib/research/dispatch.ts
 * for the Netlify-vs-local invocation split).
 *
 * Fires real metered Google API calls (Places, PageSpeed, and Gemini
 * qualification) per run. This bearer-protected route's only caller is
 * the weekly saved-search scheduled function, which calls it over HTTP
 * (unlike run-job's dev-mode direct call, the scheduled function is its
 * own process). The Lead Research page's manual "start a run" button goes
 * through startResearchRunAction (a Server Action, same pattern as
 * syncHevyAction/exportJsonBackupAction) instead of fetching this URL —
 * the browser has no bearer token to send it.
 */
export async function POST(request: NextRequest) {
  if (!hasValidBearerToken(request, "CRON_SECRET")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (await isRateLimited(admin, ROUTE, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MINUTES)) {
    return NextResponse.json({ error: "Rate limited — try again later" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = researchRunParamsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const supabase = await createClient();
  const run = await createResearchRun(supabase, parsed.data);
  await recordRateLimitEvent(admin, ROUTE);

  dispatchResearchRun(run.id, parsed.data);

  return NextResponse.json({ runId: run.id });
}
