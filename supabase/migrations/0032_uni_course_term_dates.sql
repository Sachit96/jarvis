-- Found live (2026-09-05, the morning after seeding Fall 2026): the
-- university calendar's week/day views were showing MKT 100 meeting on
-- Saturday Sept 5 — three days before the real term start (Sept 8).
-- expandWeeklyOccurrences (lib/uni/schedule-occurrences.ts) projects a
-- recurring block across a rolling window centered on "today" with
-- nothing clamping it to when the course's term actually runs, because
-- uni_courses has never had a real date range — only the free-text
-- `term` column (e.g. "Fall 2026 (2026-09-08 - 2026-12-07)"), which is
-- for display, not a queryable bound.
--
-- Both nullable: existing courses (and any added before this migration
-- reaches a given environment) have no term dates, and the app must
-- keep working for them — see the calendar page's own fallback to the
-- current unclamped window when either date is null, not a query error.
alter table public.uni_courses add column term_start date;
alter table public.uni_courses add column term_end date;
