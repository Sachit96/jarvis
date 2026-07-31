// Netlify Scheduled Function — the actual trigger for the weekly AI Mentor
// review. POST /api/mentor/run?kind=weekly has existed since Phase 5 but had
// nothing calling it on a schedule; this closes that gap. See
// mentor-daily-schedule.mts for the full rationale (relative imports, the
// admin.ts type-only "@/" reference, the logging pattern) — this file
// mirrors it exactly, just for the weekly cadence.
import { createAdminClient } from "../../lib/supabase/admin";

const JOB_NAME = "mentor_weekly_review";

async function logOutcome(status: "success" | "error", httpStatus: number | null, message: string) {
  try {
    const supabase = createAdminClient();
    await supabase.from("scheduled_runs").insert({ job_name: JOB_NAME, status, http_status: httpStatus, message });
  } catch (err) {
    console.error(`[${JOB_NAME}] failed to write scheduled_runs row:`, err);
  }
}

export default async () => {
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
    const res = await fetch(`${baseUrl}/api/mentor/run?kind=weekly`, {
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
  // Same UTC-vs-DST caveat as mentor-daily-schedule.mts. Sunday evening,
  // picked to stay clear of the UTC midnight rollover so the cron's
  // day-of-week field (0 = Sunday) never has to reason about a Toronto
  // Sunday that's already Monday in UTC:
  //
  // 22:00 UTC = 18:00 EDT (America/Toronto, mid-March–early November)
  // 22:00 UTC = 17:00 EST (America/Toronto, early November–mid-March)
  //             — one hour EARLIER than the EDT target, same drift
  //             direction/magnitude as the daily job.
  schedule: "0 22 * * 0",
};
