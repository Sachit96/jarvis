import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createResearchRun } from "@/lib/db/queries/lead-research";
import { researchRunParamsSchema } from "@/lib/validations/lead-research";
import { runResearchJob } from "@/lib/research/run-job";

/**
 * Starts a research run and returns immediately with its id — the actual
 * work never happens inline in this request. Two invocation paths:
 *
 * - On Netlify (process.env.NETLIFY is set in both `netlify dev` and real
 *   deploys): fire the dedicated Background Function, which has a 15-minute
 *   budget instead of this route's 60-second one.
 * - Local `next dev` (no Netlify runtime at all, so no 60s wall to begin
 *   with): call the job function directly, deliberately not awaited, so
 *   this route still returns immediately and the client's poll loop behaves
 *   identically in both environments.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = researchRunParamsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const supabase = await createClient();
  const run = await createResearchRun(supabase, parsed.data);

  if (process.env.NETLIFY) {
    const baseUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
    if (!baseUrl) {
      return NextResponse.json({ error: "Netlify deploy URL (process.env.URL) is not available" }, { status: 500 });
    }
    // Fire-and-forget — Background Functions return a 202 immediately and
    // run independently; we don't want this request waiting on that.
    fetch(`${baseUrl}/.netlify/functions/research-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: run.id, params: parsed.data }),
    }).catch(() => {
      // If even the trigger fetch fails, the run stays 'queued' forever —
      // visible to the user as a stuck run rather than a silent failure.
    });
  } else {
    runResearchJob(run.id, parsed.data).catch(() => {
      // runResearchJob already writes failures into research_runs itself;
      // this catch only exists so a rejected promise doesn't surface as an
      // unhandled rejection in the dev server's console.
    });
  }

  return NextResponse.json({ runId: run.id });
}
