import "server-only";
import { runResearchJob } from "@/lib/research/run-job";
import type { ResearchRunParams } from "@/lib/validations/lead-research";

/**
 * Fires an already-created research run and returns immediately — the
 * actual work never happens inline in the caller's request/action. Shared
 * by app/api/research/runs/route.ts (the bearer-protected HTTP path used by
 * the weekly saved-search scheduled function) and
 * startResearchRunAction (the Lead Research page's manual "start a run"
 * button, a Server Action) — one place owning the Netlify-vs-local branch
 * instead of two copies that could drift.
 *
 * - On Netlify (process.env.NETLIFY is set in both `netlify dev` and real
 *   deploys): fire the dedicated Background Function, which has a 15-minute
 *   budget instead of a normal request/action's ~10-60s one.
 * - Local `next dev` (no Netlify runtime, so no short wall to begin with):
 *   call the job function directly, deliberately not awaited, so the
 *   caller still returns immediately and the client's poll loop behaves
 *   identically in both environments.
 */
export function dispatchResearchRun(runId: string, params: ResearchRunParams): void {
  if (process.env.NETLIFY) {
    const baseUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
    if (!baseUrl) {
      console.error("[dispatchResearchRun] Netlify deploy URL (process.env.URL) is not available — run", runId, "stays queued");
      return;
    }
    // Fire-and-forget — Background Functions return a 202 immediately and
    // run independently; we don't want the caller waiting on that.
    fetch(`${baseUrl}/.netlify/functions/research-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId, params }),
    }).catch(() => {
      // If even the trigger fetch fails, the run stays 'queued' forever —
      // visible to the user as a stuck run rather than a silent failure.
    });
  } else {
    runResearchJob(runId, params).catch(() => {
      // runResearchJob already writes failures into research_runs itself;
      // this catch only exists so a rejected promise doesn't surface as an
      // unhandled rejection in the dev server's console.
    });
  }
}
