// Netlify Scheduled Function — the actual trigger for recurring Lead
// Research. lib/research/run-job.ts (the pipeline itself) and
// app/api/research/runs/route.ts (the endpoint that starts a run) already
// existed and were 100% manually triggered; this is the only new piece,
// closing the same "built but nothing runs it" gap as the mentor cron.
//
// Relative imports for the same reason as mentor-daily-schedule.mts: this
// file is bundled separately by Netlify's own function bundler, and its
// own entry point isn't guaranteed to resolve tsconfig path aliases.
// lib/supabase/admin.ts and lib/db/queries/lead-research.ts both only
// reference "@/..." in `import type` positions, which any TS-aware
// bundler erases at compile time regardless of alias resolution, so both
// are safe to pull in via relative paths here.
import { createAdminClient } from "../../lib/supabase/admin";
import { getDueSavedLeadSearches, markSavedLeadSearchRun } from "../../lib/db/queries/lead-research";

const JOB_NAME = "lead_research_saved_search";

// Third layer of the same hard cap as the DB check constraint (migration
// 0019) and the Zod schema (lib/validations/lead-research.ts) — enforced
// again here, right at dispatch, so nothing about how a saved search's
// row got into the table (direct DB edit, a future bug in the form) can
// let an automated run quietly request more than this.
const HARD_MAX_RESULTS = 25;

export default async () => {
  const baseUrl = process.env.URL;
  const supabase = createAdminClient();

  if (!baseUrl) {
    console.error(`[${JOB_NAME}] process.env.URL is not set — cannot call the site's own API.`);
    await supabase.from("scheduled_runs").insert({ job_name: JOB_NAME, status: "error", message: "process.env.URL is not set" });
    return;
  }

  let due: Awaited<ReturnType<typeof getDueSavedLeadSearches>>;
  try {
    due = await getDueSavedLeadSearches(supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[${JOB_NAME}] failed to read saved_lead_searches:`, message);
    await supabase.from("scheduled_runs").insert({ job_name: JOB_NAME, status: "error", message });
    return;
  }

  if (due.length === 0) {
    console.log(`[${JOB_NAME}] no saved searches due this week.`);
    await supabase.from("scheduled_runs").insert({ job_name: JOB_NAME, status: "success", message: "No saved searches due." });
    return;
  }

  // Sequential, not parallel — dispatch itself is a fast POST regardless
  // (the actual work happens later in the research-run Background
  // Function), so this only affects logging order, not how quickly the
  // real Places/audit/Gemini calls happen.
  for (const search of due) {
    const storedParams = search.params as Record<string, unknown>;
    const params = {
      ...storedParams,
      max_results: Math.min(typeof storedParams.max_results === "number" ? storedParams.max_results : 10, HARD_MAX_RESULTS),
      // A recurring run always relies on the normal 30-day cache window
      // (isCached in lib/db/queries/lead-research.ts) rather than
      // re-checking already-qualified businesses — force_refresh is
      // never persisted on a saved search (see the Zod schema's comment),
      // but hardcoded false here too, defensively, regardless of what's
      // in the stored params.
      force_refresh: false,
    };

    try {
      const res = await fetch(`${baseUrl}/api/research/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const body = await res.text();
      if (res.ok) {
        await markSavedLeadSearchRun(supabase, search.id);
        console.log(`[${JOB_NAME}] dispatched "${search.label}":`, body);
        await supabase.from("scheduled_runs").insert({ job_name: JOB_NAME, status: "success", http_status: res.status, message: `${search.label}: ${body}` });
      } else {
        console.error(`[${JOB_NAME}] "${search.label}" failed:`, res.status, body);
        await supabase.from("scheduled_runs").insert({ job_name: JOB_NAME, status: "error", http_status: res.status, message: `${search.label}: ${body}` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[${JOB_NAME}] "${search.label}" threw:`, message);
      await supabase.from("scheduled_runs").insert({ job_name: JOB_NAME, status: "error", message: `${search.label}: ${message}` });
    }
  }
};

export const config = {
  // Same UTC-vs-DST caveat as the mentor schedules (see
  // mentor-daily-schedule.mts) — anchored to EDT, drifts an hour earlier
  // during EST:
  //
  // 13:00 UTC = 09:00 EDT (America/Toronto, mid-March–early November)
  // 13:00 UTC = 08:00 EST (America/Toronto, early November–mid-March)
  //
  // Monday morning — fresh leads waiting at the start of the work week,
  // deliberately not the same slot as the Sunday-evening mentor weekly
  // review (mentor-weekly-schedule.mts) so the two don't compete for
  // Netlify's function concurrency at the same moment.
  schedule: "0 13 * * 1",
};
