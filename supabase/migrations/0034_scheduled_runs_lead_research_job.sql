-- Found live (2026-09-06): lead-research-schedule.mts logs its writes with
-- job_name = 'lead_research_saved_search', but scheduled_runs' own check
-- constraint (migration 0017) only ever allowed 'mentor_daily_brief' and
-- 'mentor_weekly_review'. Every one of that function's inserts has been
-- silently failing the constraint since the file was written — moot while
-- a separate, deeper bug (an `import "server-only"` crash at module load,
-- fixed the same day as this migration) meant the function never reached
-- the insert at all, but this needed fixing in its own right so the
-- write actually succeeds now that it can be reached.
--
-- Audited every job_name literal actually written across
-- netlify/functions/*.mts (grep for `job_name:`) before writing this —
-- exactly three values exist in the codebase: 'mentor_daily_brief',
-- 'mentor_weekly_review' (already allowed), and
-- 'lead_research_saved_search' (added here). research-run.mts writes to
-- research_runs, a different table with no such constraint — not a gap.
alter table public.scheduled_runs drop constraint scheduled_runs_job_name_check;
alter table public.scheduled_runs add constraint scheduled_runs_job_name_check
  check (job_name in ('mentor_daily_brief', 'mentor_weekly_review', 'lead_research_saved_search'));
