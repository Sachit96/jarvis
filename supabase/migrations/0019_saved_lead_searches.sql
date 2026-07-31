-- Recurring Lead Research (Work Order B2). Each row is a reusable
-- research-run configuration the weekly scheduled function
-- (netlify/functions/lead-research-schedule.mts) re-executes on its own
-- cadence. Dedupe against lead_research's existing google_place_id
-- uniqueness means a repeat run mostly skips already-seen businesses as
-- cached (see lib/db/queries/lead-research.ts's isCached, 30-day window)
-- — that's the intended behavior, not something to work around.
--
-- max_results is capped at 25 both here (DB-level backstop) and in
-- lib/validations/lead-research.ts (Zod, application-level) and again at
-- the scheduled function itself (hard clamp right before dispatch) —
-- three layers on purpose, since this is exactly the kind of thing that
-- could quietly eat the Places quota or the structured-tier Gemini budget
-- if any single layer were bypassed or edited around.
create table public.saved_lead_searches (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  params jsonb not null check (coalesce((params->>'max_results')::int, 0) <= 25),
  enabled boolean not null default true,
  -- Only "weekly" exists today — a real enum column so a future second
  -- cadence is a widened check constraint + a branch in the scheduled
  -- function, not a schema migration on top of a schema migration.
  cadence text not null default 'weekly' check (cadence in ('weekly')),
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.saved_lead_searches
  for each row execute function extensions.moddatetime(updated_at);

create index saved_lead_searches_enabled_idx on public.saved_lead_searches (enabled, last_run_at);

-- Same divergence from the pre-0012 schema as lead_research/research_runs/
-- gemini_usage/scheduled_runs — RLS enabled with zero policies, deny-all
-- to the anon key. The service-role client this app actually uses
-- bypasses this regardless.
alter table public.saved_lead_searches enable row level security;

-- scheduled_runs (migration 0017) was scoped too narrowly to the two
-- mentor jobs that existed when it was written — widen it now that a
-- second real scheduled-job type (this one) needs to log into the same
-- table, rather than either over-relaxing it to free text or standing up
-- a parallel log table for no real reason.
alter table public.scheduled_runs drop constraint scheduled_runs_job_name_check;
alter table public.scheduled_runs add constraint scheduled_runs_job_name_check
  check (job_name in ('mentor_daily_brief', 'mentor_weekly_review', 'lead_research_saved_search'));
