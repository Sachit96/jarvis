-- Visibility log for the two Netlify Scheduled Functions
-- (netlify/functions/mentor-daily-schedule.mts, mentor-weekly-schedule.mts)
-- that trigger POST /api/mentor/run on a cron. A silently-failing cron is
-- worse than no cron at all, so every invocation writes a row here
-- regardless of outcome — success or failure both need to be visible
-- without digging through Netlify's function logs.
create table public.scheduled_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null check (job_name in ('mentor_daily_brief', 'mentor_weekly_review')),
  status text not null check (status in ('success', 'error')),
  http_status int,
  message text,
  created_at timestamptz not null default now()
);

create index scheduled_runs_job_created_idx on public.scheduled_runs (job_name, created_at desc);

-- Same divergence from the pre-0012 schema as lead_research/research_runs/
-- gemini_usage (see 0015, 0016) — RLS enabled with zero policies, deny-all
-- to the anon key. The service-role client these functions actually use
-- bypasses this regardless; it's defense-in-depth, not the real gate.
alter table public.scheduled_runs enable row level security;
