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

-- Backfill for the 4 real Fall 2026 courses, folded into this same
-- migration rather than a separate run-it-then-tell-me round trip — the
-- phantom-class fix does nothing until these two columns both have real
-- values, so there's no reason to make that a second step.
--
-- Scoped by an explicit `code in (...)` list, not a blanket UPDATE, and
-- deliberately does NOT touch archived/target_grade/anything else — a
-- future term's courses (or any other course added later) must never be
-- silently stamped with these specific Fall 2026 dates just because this
-- migration happened to run after they existed. If it matches zero rows
-- (courses renamed, or seeded under different codes than expected), that
-- fails safely: term_start/term_end simply stay null for those rows, and
-- the calendar keeps its current unclamped fallback for them — it does
-- not error.
update public.uni_courses
set term_start = '2026-09-08', term_end = '2026-12-07'
where code in ('ECN 104', 'GMS 200', 'MKT 100', 'QMS 110')
  and term_start is null
  and term_end is null;
