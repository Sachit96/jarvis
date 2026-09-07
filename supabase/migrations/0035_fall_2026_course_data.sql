-- Fall 2026 real course data for GMS 200 and QMS 110 — verified against the
-- D2L outlines and TMU's Significant Dates calendar, Sept 6-7 2026. ECN 104
-- and MKT 100 have no source data and are deliberately left untouched; the
-- app-layer grade engine (lib/uni/grades.ts) and dashboard now distinguish
-- "no assessments recorded" from "graded and failing" so those two courses
-- don't silently read as 0% or drag the semester average down.
--
-- Three schema gaps this migration closes, all required to represent the
-- real source data faithfully rather than inventing values:
--
--  1. uni_assessments.weight_pct was NOT NULL — GMS 200's Peer Evaluation
--     has a genuinely unknown weight (the other 4 graded components already
--     sum to 100%), so it must be nullable, not defaulted to 0.
--  2. No no-class-dates/break-period concept existed — Thanksgiving +
--     Fall Study Week (Oct 12-16) sit inside term_start..term_end and would
--     render as phantom class days, the same failure class as the Sept 5
--     migration-0032 bug, just not yet triggered because no break period
--     had been loaded before now.
--  3. No "best N of M" / drop-lowest grading concept existed — QMS 110's
--     12 MyLabMath modules are best-10-of-12.

-- ============================================================================
-- PART 1: schema changes
-- ============================================================================

alter table public.uni_assessments alter column weight_pct drop not null;
alter table public.uni_assessments add column needs_verification boolean not null default false;
alter table public.uni_assessments add column verification_note text;

create table public.uni_assessment_groups (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.uni_courses(id) on delete cascade,
  label text not null,
  -- How many of this group's lowest-scoring graded members are excluded
  -- from every weighted-grade calculation once more than
  -- (member_count - drop_lowest_count) are graded. 0 = no dropping, just a
  -- display grouping (e.g. GMS 200's WileyPLUS assignments, all 10 count).
  drop_lowest_count int not null default 0 check (drop_lowest_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.uni_assessment_groups
  for each row execute function extensions.moddatetime(updated_at);
create index uni_assessment_groups_course_idx on public.uni_assessment_groups (course_id);
alter table public.uni_assessment_groups enable row level security;

alter table public.uni_assessments add column group_id uuid references public.uni_assessment_groups(id) on delete set null;
create index uni_assessments_group_idx on public.uni_assessments (group_id);

-- University-wide (course_id null) or per-course date ranges to exclude
-- from expandWeeklyOccurrences's weekly projection — lib/uni/schedule-
-- occurrences.ts had no concept of this at all; every recurring class
-- meeting was projected onto every matching weekday in the term regardless
-- of holidays/reading week. Deliberately separate from uni_deadlines (which
-- stays purely informational/display) so calendar-exclusion logic has one
-- unambiguous source instead of having to interpret deadline categories.
create table public.uni_no_class_periods (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.uni_courses(id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.uni_no_class_periods
  for each row execute function extensions.moddatetime(updated_at);
create index uni_no_class_periods_course_idx on public.uni_no_class_periods (course_id);
alter table public.uni_no_class_periods enable row level security;

-- 4 of the 18 TMU dates loaded below are ranges (refund window, exam
-- period, winter break) — due_at stays the range start, end_at (new,
-- nullable) is the range end when one exists.
alter table public.uni_deadlines add column end_at timestamptz;

-- ============================================================================
-- PART 2: university-wide TMU dates -> uni_deadlines
-- ============================================================================
-- Date-only values converted via `at time zone 'America/Toronto'` rather
-- than a hardcoded UTC offset so the Nov 1 2026 DST transition can't
-- silently shift a date by an hour/day for anyone reading these back.

insert into public.uni_deadlines (title, due_at, end_at, category, notes) values
  ('Labour Day (university closed)', ('2026-09-07 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'break', null),
  ('First Day of Fall Term Classes', ('2026-09-08 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'other', null),
  ('Last Day to Add/Swap a Fall Course', ('2026-09-18 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'enrolment', null),
  ('Last Day to Drop a Fall Course (full refund)', ('2026-09-18 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'withdrawal', null),
  ('Last Day to Withdraw from Program (full refund)', ('2026-09-18 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'withdrawal', null),
  ('Drop/Withdrawal 50% Refund Window', ('2026-09-19 12:00:00'::timestamp at time zone 'America/Toronto'), ('2026-10-09 12:00:00'::timestamp at time zone 'America/Toronto'), 'withdrawal', null),
  ('Last Day for Full Payment of Fall Tuition', ('2026-09-25 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'tuition', null),
  ('National Day for Truth and Reconciliation', ('2026-09-30 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'other', 'Classes remain open.'),
  ('Thanksgiving (university closed)', ('2026-10-12 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'break', null),
  ('Fall Study Week (no classes)', ('2026-10-13 12:00:00'::timestamp at time zone 'America/Toronto'), ('2026-10-16 12:00:00'::timestamp at time zone 'America/Toronto'), 'break', null),
  ('Remembrance Day', ('2026-11-11 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'other', 'Classes remain open.'),
  ('Last Day to Drop/Withdraw (no refund)', ('2026-11-20 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'withdrawal', null),
  ('Last Day of Fall Term Classes', ('2026-12-07 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'other', null),
  ('Fall Term Undergraduate Study Day', ('2026-12-08 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'other', null),
  ('Fall Examination Period', ('2026-12-09 12:00:00'::timestamp at time zone 'America/Toronto'), ('2026-12-20 12:00:00'::timestamp at time zone 'America/Toronto'), 'exam_period', 'Includes weekends.'),
  ('Last Day to Clear Debt (grades not withheld)', ('2026-12-14 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'tuition', null),
  ('Official End of Fall Term', ('2026-12-20 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'other', null),
  ('Mid-Year Winter Break', ('2026-12-23 12:00:00'::timestamp at time zone 'America/Toronto'), ('2027-01-07 12:00:00'::timestamp at time zone 'America/Toronto'), 'break', null);

-- The one no-class period this term that falls inside term_start..term_end
-- and would otherwise render phantom class occurrences (the Sept 5 MKT 100
-- bug's failure class) — Thanksgiving + Fall Study Week, back to back.
-- course_id null = applies to every course, since no course meets that week.
insert into public.uni_no_class_periods (course_id, start_date, end_date, label) values
  (null, '2026-10-12', '2026-10-16', 'Thanksgiving + Fall Study Week');

-- ============================================================================
-- PART 3: GMS 200 / QMS 110 assessments
-- ============================================================================
-- Course-code lookup normalizes "GMS200"/"QMS110" (source outline format,
-- no space) against whatever's actually stored (confirmed live: "GMS 200"/
-- "QMS 110", with a space, matching the 0032 backfill) by stripping spaces
-- and case before comparing, instead of a hardcoded exact-string list. Fails
-- safe per course (raise notice + skip its inserts) rather than aborting
-- the whole migration if a code doesn't match anything.

do $$
declare
  v_gms200 uuid;
  v_qms110 uuid;
  v_wileyplus_group uuid;
  v_globus_group uuid;
  v_mylab_group uuid;
begin
  select id into v_gms200 from public.uni_courses where replace(upper(code), ' ', '') = 'GMS200' limit 1;
  select id into v_qms110 from public.uni_courses where replace(upper(code), ' ', '') = 'QMS110' limit 1;

  -- ==========================================================================
  -- GMS 200
  -- ==========================================================================
  if v_gms200 is null then
    raise notice 'GMS 200 not found (matched against code with spaces/case stripped) — skipping its assessment import';
  else
    -- WileyPLUS chapter assignments: 10 total, 1pt/10% each, weeks 2-4,6-7,9-13.
    -- Due times unknown (behind Wiley login) — due_at left null rather than
    -- guessing a date within the stated week.
    insert into public.uni_assessment_groups (course_id, label, drop_lowest_count)
      values (v_gms200, 'WileyPLUS chapter assignments', 0)
      returning id into v_wileyplus_group;

    insert into public.uni_assessments (course_id, group_id, title, type, due_at, weight_pct, status, source, needs_verification, verification_note)
    select v_gms200, v_wileyplus_group, 'WileyPLUS Ch. Assignment — Week ' || wk, 'assignment', null, 1.0, 'not_started', 'manual', true,
      'Due time unknown — behind WileyPLUS login. Date within week ' || wk || ' not specified in outline.'
    from unnest(array[2,3,4,6,7,9,10,11,12,13]) as wk;

    -- Glo-Bus decisions: 8 total, team of 5. Weeks 4 & 6 explicitly ungraded
    -- practice (weight_pct = 0, a real known zero, not "unknown" -> not
    -- flagged). Weeks 7-12 ("Year 6"-"Year 11") are graded but the outline
    -- gives no individual weight for them, and GMS 200's other 4 graded
    -- components (WileyPLUS 10 + Midterm 30 + Glo-Bus Final Report/Ranking
    -- 20 + Final Exam 40) already sum to exactly 100% -- read here as
    -- feeding into the Final Report/Ranking grade rather than carrying
    -- independent weight, and flagged as an inference rather than assumed
    -- silently (interpretive decision 1 in the review plan).
    insert into public.uni_assessment_groups (course_id, label, drop_lowest_count)
      values (v_gms200, 'Glo-Bus decisions', 0)
      returning id into v_globus_group;

    insert into public.uni_assessments (course_id, group_id, title, type, due_at, weight_pct, status, source, needs_verification, verification_note)
    values
      (v_gms200, v_globus_group, 'Glo-Bus Decision — Week 4 (Practice, ungraded)', 'assignment', null, 0, 'not_started', 'manual', false, null),
      (v_gms200, v_globus_group, 'Glo-Bus Decision — Week 6 (Practice, ungraded)', 'assignment', null, 0, 'not_started', 'manual', false, null),
      (v_gms200, v_globus_group, 'Glo-Bus Decision — Year 6 (Week 7)', 'assignment', null, 0, 'not_started', 'manual', true,
        'Outline gives no individual grade weight for this decision round; GMS 200''s other 4 graded components already total 100% (10 WileyPLUS + 30 Midterm + 20 Glo-Bus Final Report/Ranking + 40 Final Exam), so this likely feeds into the Final Report/Ranking grade rather than carrying separate weight. Confirm with instructor.'),
      (v_gms200, v_globus_group, 'Glo-Bus Decision — Year 7 (Week 8)', 'assignment', null, 0, 'not_started', 'manual', true,
        'Outline gives no individual grade weight for this decision round — see Year 6 note.'),
      (v_gms200, v_globus_group, 'Glo-Bus Decision — Year 8 (Week 9)', 'assignment', null, 0, 'not_started', 'manual', true,
        'Outline gives no individual grade weight for this decision round — see Year 6 note.'),
      (v_gms200, v_globus_group, 'Glo-Bus Decision — Year 9 (Week 10)', 'assignment', null, 0, 'not_started', 'manual', true,
        'Outline gives no individual grade weight for this decision round — see Year 6 note.'),
      (v_gms200, v_globus_group, 'Glo-Bus Decision — Year 10 (Week 11)', 'assignment', null, 0, 'not_started', 'manual', true,
        'Outline gives no individual grade weight for this decision round — see Year 6 note.'),
      (v_gms200, v_globus_group, 'Glo-Bus Decision — Year 11 (Week 12)', 'assignment', null, 0, 'not_started', 'manual', true,
        'Outline gives no individual grade weight for this decision round — see Year 6 note.');

    -- Midterm Exam: date confirmed (2026-11-02, a Monday), "during class
    -- time" — GMS 200's real Monday lecture block is 18:00-21:00 (matches
    -- the Mid-term Practice Questions' separately-stated 6:00 PM time), so
    -- the actual scheduled class start is used rather than a guess, and
    -- this is NOT flagged since it's derived from real schedule data.
    insert into public.uni_assessments (course_id, title, type, due_at, weight_pct, max_score, status, source, notes, needs_verification)
    values (v_gms200, 'Midterm Exam', 'midterm', ('2026-11-02 18:00:00'::timestamp at time zone 'America/Toronto'), 30, 100, 'not_started', 'manual',
      '70 MC/T-F, chapters 1,2,5,7,8. 60 min, closed book, one-page crib sheet allowed.', false);

    -- Mid-term Practice Questions: ungraded, explicit date+time given.
    insert into public.uni_assessments (course_id, title, type, due_at, weight_pct, max_score, status, source, notes, needs_verification)
    values (v_gms200, 'Mid-term Practice Questions', 'quiz', ('2026-11-02 18:00:00'::timestamp at time zone 'America/Toronto'), 0, 100, 'not_started', 'manual',
      'Ungraded, D2L Quiz tool, ~20 min, unlimited attempts.', false);

    -- Glo-Bus Final Report & Company Ranking: split into the two rows the
    -- outline itself breaks it into (10% report + 10% ranking). Date given
    -- (Week 13 / Dec 7), exact time not specified.
    insert into public.uni_assessments (course_id, title, type, due_at, weight_pct, max_score, status, source, needs_verification, verification_note)
    values
      (v_gms200, 'Glo-Bus Final Report', 'presentation', ('2026-12-07 12:00:00'::timestamp at time zone 'America/Toronto'), 10, 100, 'not_started', 'manual', true, 'Exact time not specified in outline — Week 13 (Dec 7) date only.'),
      (v_gms200, 'Glo-Bus Company Ranking', 'presentation', ('2026-12-07 12:00:00'::timestamp at time zone 'America/Toronto'), 10, 100, 'not_started', 'manual', true, 'Exact time not specified in outline — Week 13 (Dec 7) date only.');

    -- Peer Evaluation: weight genuinely unknown (the other 4 graded items
    -- already sum to 100%) -> weight_pct left null, not defaulted to 0.
    -- Dec 7 date is an explicit working assumption per the source, not a
    -- confirmed date.
    insert into public.uni_assessments (course_id, title, type, due_at, weight_pct, max_score, status, source, needs_verification, verification_note)
    values (v_gms200, 'Peer Evaluation', 'participation', ('2026-12-07 12:00:00'::timestamp at time zone 'America/Toronto'), null, 100, 'not_started', 'manual', true,
      'Weight unknown — GMS 200''s other 4 graded components already sum to 100% (10 WileyPLUS + 30 Midterm + 20 Glo-Bus Final Report/Ranking + 40 Final Exam). Dec 7 date is a working assumption (Week 13 row) pending instructor confirmation, not a confirmed date.');

    -- Final Exam: date TBD per outline, falls within Dec 9-20 exam period.
    insert into public.uni_assessments (course_id, title, type, due_at, weight_pct, max_score, status, source, notes, needs_verification, verification_note)
    values (v_gms200, 'Final Exam', 'final', null, 40, 100, 'not_started', 'manual',
      '120 MC/T-F, all chapters, 120 min.', true, 'Date TBD per outline. Falls within the Dec 9-20 Fall Examination Period. GMS 200''s "Preparing for Exams" PDF may name a date — see the flagged material on this course.');
  end if;

  -- ==========================================================================
  -- QMS 110
  -- ==========================================================================
  if v_qms110 is null then
    raise notice 'QMS 110 not found (matched against code with spaces/case stripped) — skipping its assessment import';
  else
    -- MyLabMath modules: 12 total, BEST 10 COUNT, 20% combined. Each row is
    -- weighted 20/10 = 2.0%, not 20/12 -- this is the group-aware
    -- convention lib/uni/grades.ts's drop-lowest logic depends on: once
    -- more than 10 of the 12 are graded, the lowest-scoring excess ones are
    -- excluded entirely (both numerator and denominator) so the surviving
    -- 10 correctly land on the full 20%, not a diluted 16.67%. A naive
    -- SUM(weight_pct) across all 12 rows therefore reads 24%, not 20% --
    -- expected, not an error; see the group-aware verification query
    -- handed back separately.
    insert into public.uni_assessment_groups (course_id, label, drop_lowest_count)
      values (v_qms110, 'MyLabMath modules', 2)
      returning id into v_mylab_group;

    insert into public.uni_assessments (course_id, group_id, title, type, due_at, weight_pct, status, source, needs_verification, verification_note)
    select v_qms110, v_mylab_group, 'MyLabMath Module ' || n, 'assignment', null, 2.0, 'not_started', 'manual', true,
      'Due time unknown — behind Pearson/MyLabMath login. One module per course-schedule week; exact day not specified in outline.'
    from generate_series(1, 12) as n;

    -- Midterm Test 1: date/time fully given, but Nov 8 2026 is a Sunday --
    -- flagged per the outline's own "flag for verification" note (not one
    -- of the 7 enumerated items, but explicitly called out in the source).
    insert into public.uni_assessments (course_id, title, type, due_at, weight_pct, max_score, status, source, notes, needs_verification, verification_note)
    values (v_qms110, 'Midterm Test 1', 'midterm', ('2026-11-08 13:00:00'::timestamp at time zone 'America/Toronto'), 35, 100, 'not_started', 'manual',
      'Covers Weeks 1-6 / Modules 1-6. 2 hrs. Non-programmable calculator + one-page crib sheet only.', true,
      'Nov 8, 2026 falls on a Sunday per the outline — confirm before relying on this date.');

    -- Final Exam: date/time TBA per outline, falls within Dec 9-20 exam period.
    insert into public.uni_assessments (course_id, title, type, due_at, weight_pct, max_score, status, source, notes, needs_verification, verification_note)
    values (v_qms110, 'Final Exam', 'final', null, 45, 100, 'not_started', 'manual',
      'All 12 modules, 2.5 hrs.', true, 'Date/time TBA per outline. Falls within the Dec 9-20 Fall Examination Period.');

    -- QMS 110 PAL study group: optional, ungraded, no fixed weight/date --
    -- not an assessment (no grade weight) and not a schedule block (its
    -- type check constraint is lecture/tutorial/lab/office_hours, none of
    -- which honestly describes an optional peer-run session; putting it
    -- there would make it look mandatory and subject to term/no-class
    -- clamping). Recorded as an informational material instead.
    insert into public.uni_materials (course_id, title, type, body)
    values (v_qms110, 'QMS 110 PAL Study Group', 'other',
      'Optional, ungraded peer-assisted-learning study group. Weekly starting the week of Sept 21. Run by Jill and Safwan via the PASS Tutoring Centre. In-person and virtual.');
  end if;

  -- GMS 200 "Preparing for Exams" PDF may name a Final Exam date -- flagged
  -- as a material to check, not used to fabricate a date on the Final Exam
  -- row above.
  if v_gms200 is not null then
    insert into public.uni_materials (course_id, title, type, body)
    values (v_gms200, 'GMS 200 — "Preparing for Exams" PDF (check for Final Exam date)', 'other',
      'Source outline references a "Preparing for Exams" PDF that may name the Final Exam date, which is otherwise listed as TBD. Not yet checked — verify before treating the Final Exam as undated.');
  end if;
end $$;
