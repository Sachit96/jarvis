console.log("BOOT mentor-daily-schedule");
// DIAGNOSTIC (2026-09-06) — temporary, remove once resolved. The line
// above is the literal first line of this file, above every import, so
// nothing can throw before it runs. If it doesn't appear in the function
// log after a real invocation, the module was never loaded at all — a
// bundling/registration problem, not a runtime crash inside the handler.
//
// Netlify Scheduled Function — the actual trigger for the daily AI Mentor
// brief. POST /api/mentor/run?kind=daily has existed since Phase 5 but had
// nothing calling it on a schedule; this closes that gap.
//
// Relative imports, not the app's "@/..." alias — this file is bundled by
// Netlify's own function bundler, separately from the Next.js build, and
// its own entry point isn't guaranteed to resolve tsconfig path aliases.
//
// createAdminClient comes from the _shared/ duplicate, NOT lib/supabase/
// admin.ts directly — found live (2026-09-06): admin.ts opens with
// `import "server-only"`, whose unconditional real implementation crashes
// at module load under any bundler that isn't Next.js's own (Netlify's
// function bundler has no "react-server" condition configured). That
// crash happened before this file's own try/catch or logOutcome ever ran,
// for every invocation since this file was written — see
// _shared/admin-client.ts's own comment for the full mechanism.
import { createAdminClient } from "./_shared/admin-client";

const JOB_NAME = "mentor_daily_brief";

async function logOutcome(status: "success" | "error", httpStatus: number | null, message: string) {
  try {
    const supabase = createAdminClient();
    await supabase.from("scheduled_runs").insert({ job_name: JOB_NAME, status, http_status: httpStatus, message });
  } catch (err) {
    // The log write itself failing must never throw past this point — the
    // Netlify function log is the fallback channel if even that fails.
    console.error(`[${JOB_NAME}] failed to write scheduled_runs row:`, err);
  }
}

// Netlify's documented scheduled-function contract (verified live against
// current docs, 2026-09-06, not recalled) is `async (req: Request) => {...}`
// — this handler took zero parameters instead, since the day it was
// written. Extra JS args are normally silently ignored, but this
// function's registered invocation model is "stream" (a Request/Response-
// oriented contract), and a handler that never engages with that contract
// is the leading candidate for why invocation produces literally zero log
// output — not even this file's own pre-import BOOT line — while Netlify
// still reports success and advances the schedule. `req` isn't otherwise
// used; the real payload only carries `next_run`, which this job doesn't need.
export default async (req: Request) => {
  void req;
  const baseUrl = process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!baseUrl) {
    console.error(`[${JOB_NAME}] process.env.URL is not set — cannot call the site's own API.`);
    await logOutcome("error", null, "process.env.URL is not set");
    return;
  }
  if (!secret) {
    console.error(`[${JOB_NAME}] CRON_SECRET is not set — /api/mentor/run would reject this anyway.`);
    await logOutcome("error", null, "CRON_SECRET is not set");
    return;
  }

  try {
    const res = await fetch(`${baseUrl}/api/mentor/run?kind=daily`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    if (res.ok) {
      console.log(`[${JOB_NAME}] ok:`, body);
      await logOutcome("success", res.status, body);
    } else {
      console.error(`[${JOB_NAME}] failed:`, res.status, body);
      await logOutcome("error", res.status, body);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[${JOB_NAME}] fetch threw:`, message);
    await logOutcome("error", null, message);
  }
};

export const config = {
  // Netlify cron schedules run in UTC — there is no per-schedule timezone
  // option, so a fixed UTC hour necessarily drifts by an hour across DST
  // rather than tracking "6am America/Toronto" year-round.
  //
  // 10:00 UTC = 06:00 EDT (America/Toronto, mid-March–early November,
  //             the majority of the year) — the target.
  // 10:00 UTC = 05:00 EST (America/Toronto, early November–mid-March)
  //             — one hour EARLIER than intended during this stretch.
  //
  // Picked EDT as the anchor since it covers ~8 of 12 months. If exact
  // local time matters later, this needs either two seasonal cron entries
  // swapped by hand around the DST transition dates, or in-function logic
  // checking the date and only proceeding in the intended local hour.
  schedule: "0 10 * * *",
};
