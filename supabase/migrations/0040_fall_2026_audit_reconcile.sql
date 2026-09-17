-- Fall 2026 D2L audit reconciliation.
--
-- Source: a Fall 2026 Course Audit artifact the user supplied, itself
-- compiled from a full inspection of all five TMU D2L course shells plus
-- the official TMU Significant Dates calendar on Sept 15 2026 (the
-- artifact's own footer states this and states nothing was changed or
-- submitted on any platform during that inspection). Every professor
-- name, email, room, section code, date and weight below is copied
-- directly from that artifact, not looked up or inferred independently —
-- none of it has been cross-checked against TMU systems by either Claude
-- session. Where it disagrees with what UniOS already holds, it overwrites
-- the older value: the user was asked directly, in the same conversation
-- that produced this file, which source should win on a schedule
-- conflict, and said override the old data with whatever the audit says.
-- That instruction is why this file overwrites rather than merges; it is
-- not this migration's own judgment call.
--
-- What this closes, in order of how much it was costing:
--
--  1. ECN 440 did not exist in UniOS at all. Migration 0032 backfilled
--     term dates for exactly four codes and nothing since added a fifth,
--     so an entire course — 100 points of weight, a 30% term paper and a
--     40% final — was invisible to lib/uni/grades.ts.
--  2. ECN 104 and MKT 100 had zero assessments. Migration 0035 says so in
--     its own header: it loaded GMS 200 and QMS 110 only, because there
--     was no source data for the other two. This is that source data.
--  3. Schedule blocks were wrong. ECN 104 was recorded as Tue 9am-12pm;
--     the outline reads Tue 8:10-11:00am in DSQ06. QMS 110 and MKT 100
--     had blocks whose times appear nowhere in D2L at all.
--  4. Nothing recorded WHERE graded work is submitted. Three courses do
--     their weekly graded work on external platforms (MyLabMath,
--     WileyPLUS, Glo-Bus) and a fourth on HowTheMarketWorks — the single
--     largest verification gap the audit found, and previously survivable
--     only as prose inside verification_note.
--  5. Assessments had no open date, only a due date — so a window like
--     MKT 100's Survey #1 (opens Sep 19, closes Sep 26) or the
--     Comprehensive Metrics Quiz (Nov 28 - Dec 7) could not be
--     represented as a window at all.
--  6. uni_deadlines was university-wide only, with no course_id — so a
--     course-specific non-graded deadline (email the instructor by Sep 18
--     to opt into the alternate assignment; join a Glo-Bus team by Week 4
--     or drop the course) had nowhere to live except as a fake zero-weight
--     assessment polluting the grade engine.
--
-- Deliberately NOT done here: no new values are added to
-- uni_assessments.type. Its check constraint is mirrored by a hardcoded
-- ASSESSMENT_TYPES const in lib/validations/uni.ts and a label map in
-- components/uni/assessment-form.tsx, so widening it in the database
-- without a matching code change would produce rows the form cannot
-- create and the UI renders with an undefined label. Surveys and projects
-- are therefore mapped onto existing types and the real nature recorded in
-- notes. Adding 'project'/'survey'/'exam' properly is a code change, and
-- code changes cost a deploy.
--
-- Every column added below is nullable or defaulted, so existing code
-- keeps working untouched — the standing "degrade gracefully" rule.
--
-- Safe to re-run: every insert block is guarded, and nothing is deleted
-- except the schedule blocks this migration then replaces. Verified by
-- running it twice against a throwaway Postgres 16 carrying the same
-- schema state (0021 + 0032 + 0035 + 0038) — second run changed no counts.

-- ============================================================================
-- PART 1: schema
-- ============================================================================

-- Where the work is actually submitted. Free text, no check constraint, so
-- a sixth platform next term does not need a seventh migration.
alter table public.uni_assessments add column if not exists platform text;

-- Window open time. due_at remains the close/deadline.
alter table public.uni_assessments add column if not exists opens_at timestamptz;

-- Course-scoped deadlines. Null keeps the existing 18 rows university-wide,
-- which is what they are. Mirrors the nullable course_id on
-- uni_no_class_periods rather than inventing a second pattern.
alter table public.uni_deadlines add column if not exists course_id uuid
  references public.uni_courses(id) on delete cascade;
create index if not exists uni_deadlines_course_idx on public.uni_deadlines (course_id);

-- Enrolled section. MKT 100's D2L shell serves five sections at once and
-- the audit could not determine which one is actually enrolled, which is
-- also why its Zoom time is unknown — this is where that resolves once
-- MyServiceHub is checked.
alter table public.uni_courses add column if not exists section text;

-- ============================================================================
-- PART 2: ECN 440 — the missing fifth course
-- ============================================================================

do $$
declare
  v_ecn440 uuid;
  v_term text;
  v_credit numeric(4,2);
begin
  select id into v_ecn440 from public.uni_courses
    where replace(upper(code), ' ', '') = 'ECN440' limit 1;

  if v_ecn440 is not null then
    raise notice 'ECN 440 already exists — skipping course creation, will still reconcile below';
  else
    -- Inherit term string and credit weight from an existing Fall 2026
    -- course rather than hardcoding, so ECN 440 sorts and weighs
    -- identically to its siblings in the semester average. If no sibling
    -- is found the table defaults apply.
    select term, credit_weight into v_term, v_credit
      from public.uni_courses
      where replace(upper(code), ' ', '') = 'ECN104' limit 1;

    insert into public.uni_courses
      (code, name, professor, professor_email, room, term, term_start, term_end, credit_weight, description)
    values (
      'ECN 440',
      'Economic Issues in Financial Markets',
      'Teresa Fung',
      't3fung@torontomu.ca',
      'TRS-2147',
      coalesce(v_term, 'Fall 2026 (2026-09-08 - 2026-12-07)'),
      '2026-09-08',
      '2026-12-07',
      coalesce(v_credit, 3.0),
      'No midterm. Graded on in-class assessments, the Stock Market Game and report, a term paper, and a final. Term paper compares two of nine historical financial crises; Turnitin required, one resubmission only after a failed check.'
    )
    returning id into v_ecn440;
    raise notice 'ECN 440 created';
  end if;
end $$;

-- ============================================================================
-- PART 3: course metadata from the outlines (audit overwrites what's there)
-- ============================================================================

update public.uni_courses set
  professor = 'Germán Pupato', professor_email = 'gpupato@torontomu.ca',
  room = 'DSQ06', section = '061'
where replace(upper(code), ' ', '') = 'ECN104';

update public.uni_courses set
  professor = 'Nursel Selver Ruzgar', professor_email = 'nruzgar@torontomu.ca',
  section = '061/071'
where replace(upper(code), ' ', '') = 'QMS110';

update public.uni_courses set
  professor = 'Mohamed Elmi', room = 'TRS2-166', section = '701E'
where replace(upper(code), ' ', '') = 'GMS200';

update public.uni_courses set
  professor = 'Jane Lee Saber', professor_email = 'jsaber@torontomu.ca',
  room = 'Zoom'
where replace(upper(code), ' ', '') = 'MKT100';

-- ECN 440 gets the same term clamp as the other four, in case it already
-- existed before this migration with null term dates.
update public.uni_courses
set term_start = '2026-09-08', term_end = '2026-12-07'
where replace(upper(code), ' ', '') = 'ECN440'
  and (term_start is null or term_end is null);

-- ============================================================================
-- PART 4: schedule blocks — replaced wholesale from the outlines
-- ============================================================================
-- uni_attendance.schedule_block_id is ON DELETE SET NULL, so existing
-- attendance rows survive this and simply lose their block link; the
-- attendance record itself (course + date + status) is preserved. Confirmed
-- live on the throwaway instance, not assumed from reading the constraint.
--
-- QMS 110 and MKT 100 get NO block. That is the honest reading of the
-- source, not an omission:
--   - QMS 110's outline says only "in person at a scheduled time in a
--     designated room" — no day, no time, no room anywhere in D2L.
--   - MKT 100's shell serves five sections with five different Monday Zoom
--     times and the enrolled section is not determinable from course
--     content. The outline is explicit that classes are Mondays only and
--     every other listed time is independent study, so the old Saturday
--     block was never a class.
-- Both are given a dated course-scoped deadline in Part 6 instead, timed
-- before the Sep 18 add/drop cutoff, so the gap surfaces rather than
-- sitting silently as a wrong time on the calendar.

do $$
declare
  v_ecn104 uuid; v_ecn440 uuid; v_qms110 uuid; v_gms200 uuid; v_mkt100 uuid;
begin
  select id into v_ecn104 from public.uni_courses where replace(upper(code),' ','') = 'ECN104' limit 1;
  select id into v_ecn440 from public.uni_courses where replace(upper(code),' ','') = 'ECN440' limit 1;
  select id into v_qms110 from public.uni_courses where replace(upper(code),' ','') = 'QMS110' limit 1;
  select id into v_gms200 from public.uni_courses where replace(upper(code),' ','') = 'GMS200' limit 1;
  select id into v_mkt100 from public.uni_courses where replace(upper(code),' ','') = 'MKT100' limit 1;

  delete from public.uni_schedule_blocks
   where course_id in (v_ecn104, v_ecn440, v_qms110, v_gms200, v_mkt100);

  -- day_of_week: 0 = Sunday, matching JS Date#getDay() per 0021.
  if v_ecn104 is not null then
    insert into public.uni_schedule_blocks (course_id, type, day_of_week, start_time, end_time, room)
    values (v_ecn104, 'lecture', 2, '08:10', '11:00', 'DSQ06');
  end if;

  if v_ecn440 is not null then
    insert into public.uni_schedule_blocks (course_id, type, day_of_week, start_time, end_time, room)
    values (v_ecn440, 'lecture', 4, '10:00', '12:00', 'TRS-2147'),
           (v_ecn440, 'lecture', 1, '16:00', '17:00', 'TRS-1147');
  end if;

  if v_gms200 is not null then
    insert into public.uni_schedule_blocks (course_id, type, day_of_week, start_time, end_time, room)
    values (v_gms200, 'lecture', 1, '18:00', '21:00', 'TRS2-166');
  end if;

  raise notice 'Schedule blocks replaced. QMS 110 and MKT 100 intentionally have none — times unpublished in D2L.';
end $$;

-- ============================================================================
-- PART 5: assessments
-- ============================================================================

do $$
declare
  v_ecn104 uuid; v_ecn440 uuid; v_qms110 uuid; v_gms200 uuid; v_mkt100 uuid;
  v_grp uuid;
begin
  select id into v_ecn104 from public.uni_courses where replace(upper(code),' ','') = 'ECN104' limit 1;
  select id into v_ecn440 from public.uni_courses where replace(upper(code),' ','') = 'ECN440' limit 1;
  select id into v_qms110 from public.uni_courses where replace(upper(code),' ','') = 'QMS110' limit 1;
  select id into v_gms200 from public.uni_courses where replace(upper(code),' ','') = 'GMS200' limit 1;
  select id into v_mkt100 from public.uni_courses where replace(upper(code),' ','') = 'MKT100' limit 1;

  -- ==========================================================================
  -- ECN 104 — Midterm 35 / Final 45 / Weekly 20 = 100
  -- ==========================================================================
  if v_ecn104 is null then
    raise notice 'ECN 104 not found — skipping';
  elsif exists (select 1 from public.uni_assessments where course_id = v_ecn104) then
    raise notice 'ECN 104 already has assessments — skipping insert, review manually before re-running';
  else
    insert into public.uni_assessments
      (course_id, title, type, due_at, weight_pct, max_score, status, source, platform, notes, needs_verification, verification_note)
    values
      (v_ecn104, 'Midterm Exam', 'midterm',
        ('2026-10-20 08:00:00'::timestamp at time zone 'America/Toronto'), 35, 100, 'not_started', 'manual', 'In-person',
        'Closed-book multiple choice, DSQ06. Covers roughly topics 1-5/6 (everything through Oct 20).', false, null),
      (v_ecn104, 'Final Exam', 'final',
        null, 45, 100, 'not_started', 'manual', 'In-person',
        'In-person. NOT cumulative — post-midterm topics only.', true,
        'Date TBA; outline gives none. Falls within the Dec 9-20 Fall Examination Period.');

    -- Weekly assignments: 10 of them, 20% combined, marked on completion
    -- only. All 10 count (no drop-lowest), so 2.0% each.
    insert into public.uni_assessment_groups (course_id, label, drop_lowest_count)
      values (v_ecn104, 'Weekly assignments', 0) returning id into v_grp;

    -- Assignment 1 is the only one with a real date, and it has already
    -- passed unsubmitted. Left at 'not_started' deliberately so it reads as
    -- overdue on /uni rather than being quietly marked submitted.
    insert into public.uni_assessments
      (course_id, group_id, title, type, due_at, weight_pct, max_score, status, source, platform, notes, needs_verification, verification_note)
    values (v_ecn104, v_grp, 'Weekly Assignment 1', 'assignment',
      ('2026-09-14 23:59:00'::timestamp at time zone 'America/Toronto'), 2.0, 100, 'not_started', 'manual', 'D2L',
      'OVERDUE as of the Sept 15 audit — not submitted. Course policy states no late submissions and NO exceptions.', true,
      'Contact the instructor before assuming this is a zero. The outline''s "Rule #1" is that emails already answered in class/D2L/the outline go unanswered, so reference the policy directly.');

    insert into public.uni_assessments
      (course_id, group_id, title, type, due_at, weight_pct, max_score, status, source, platform, needs_verification, verification_note)
    select v_ecn104, v_grp, 'Weekly Assignment ' || n, 'assignment', null, 2.0, 100, 'not_started', 'manual', 'D2L', true,
      'Not yet posted in D2L Content as of the Sept 15 audit; weekly release expected. Marked on completion only, no late submissions.'
    from generate_series(2, 10) as n;

    raise notice 'ECN 104 loaded: 2 exams + 10 weekly assignments = 100%%';
  end if;

  -- ==========================================================================
  -- ECN 440 — In-class 10 / Game 20 / Paper 30 / Final 40 = 100. No midterm.
  -- ==========================================================================
  if v_ecn440 is null then
    raise notice 'ECN 440 not found — skipping';
  elsif exists (select 1 from public.uni_assessments where course_id = v_ecn440) then
    raise notice 'ECN 440 already has assessments — skipping insert';
  else
    insert into public.uni_assessments
      (course_id, title, type, opens_at, due_at, weight_pct, max_score, status, source, platform, notes, needs_verification, verification_note)
    values
      -- Count and dates of the individual in-class assessments are not
      -- stated anywhere in the outline, so this is one combined row rather
      -- than an invented number of children. Split it once the real count
      -- is known.
      (v_ecn440, 'In-Class Assessments (combined)', 'quiz',
        null, null, 10, 100, 'not_started', 'manual', 'In-person',
        'Administered throughout the term during lecture, on paper. Best scores are selected at term end.', true,
        'Outline gives neither the number of in-class assessments nor their dates. Recorded as one combined 10% row; split into individual rows once the count is known.'),

      (v_ecn440, 'Stock Market Game & Report', 'assignment',
        ('2026-09-28 12:00:00'::timestamp at time zone 'America/Toronto'),
        ('2026-10-30 12:00:00'::timestamp at time zone 'America/Toronto'), 20, 100, 'not_started', 'manual', 'HowTheMarketWorks',
        'Contest runs Sep 28 - Oct 23 on howthemarketworks.com. Report is 1,000-2,000 words plus weekly trading records, due Oct 30.', true,
        'Exact contest deadlines live on howthemarketworks.com and need a separate login — not verifiable from D2L. Report time of day not specified.'),

      (v_ecn440, 'Term Paper', 'assignment',
        null, ('2026-12-04 12:00:00'::timestamp at time zone 'America/Toronto'), 30, 100, 'not_started', 'manual', 'D2L',
        '2,000-3,000 words, APA. Compare and contrast two of the nine historical financial crises covered in lectures. Due on or before Dec 4. Turnitin required — one resubmission only, after a failed check.', true,
        'No D2L dropbox folder existed for this as of the Sept 15 audit. Time of day not specified.'),

      (v_ecn440, 'Final Examination', 'final',
        null, null, 40, 100, 'not_started', 'manual', 'In-person',
        '120 minutes, essay format, typed.', true,
        'Outline says only "December" — no date published. Falls within the Dec 9-20 Fall Examination Period. A missed exam needs an ACR within 3 working days; a make-up is guaranteed here because this exam is over 30% of the grade.');

    raise notice 'ECN 440 loaded: 4 components = 100%%';
  end if;

  -- ==========================================================================
  -- MKT 100 — Midterm 37.5 / Final 37.5 / Comp Quiz 10 / Metrics 10 /
  --           Surveys 5 = 100, plus an uncounted bonus.
  -- ==========================================================================
  if v_mkt100 is null then
    raise notice 'MKT 100 not found — skipping';
  elsif exists (select 1 from public.uni_assessments where course_id = v_mkt100) then
    raise notice 'MKT 100 already has assessments — skipping insert';
  else
    insert into public.uni_assessments
      (course_id, title, type, opens_at, due_at, weight_pct, max_score, status, source, platform, notes, needs_verification, verification_note)
    values
      (v_mkt100, 'Midterm Exam', 'midterm',
        null, ('2026-10-25 12:00:00'::timestamp at time zone 'America/Toronto'), 37.5, 100, 'not_started', 'manual', 'In-person',
        'Sunday Oct 25. Multiple choice, 120 minutes, on campus, written on your own device with Respondus LockDown Browser. The device must hold charge for 150+ minutes. Writing in the wrong assigned location is an automatic zero.', true,
        'Date is confirmed; the outline states "Time: TBD" and the room is TBA. The noon timestamp here is a placeholder for the date, not a real start time.'),

      (v_mkt100, 'Final Examination', 'final',
        null, null, 37.5, 100, 'not_started', 'manual', 'In-person',
        '120 minutes, in person, Respondus LockDown Browser. There is no minimum grade required on the final to pass — only an overall passing average.', true,
        'Date and time TBA. Falls within the Dec 9-20 Fall Examination Period.'),

      (v_mkt100, 'Comprehensive Metrics Quiz', 'quiz',
        ('2026-11-28 09:00:00'::timestamp at time zone 'America/Toronto'),
        ('2026-12-07 23:59:00'::timestamp at time zone 'America/Toronto'), 10, 100, 'not_started', 'manual', 'D2L',
        '30 minutes, one sitting, ONE attempt only — unlike the weekly metrics quizzes, there is no second try.', false, null),

      (v_mkt100, 'Survey / Alt. Assignment #1', 'assignment',
        ('2026-09-19 12:00:00'::timestamp at time zone 'America/Toronto'),
        ('2026-09-26 23:59:00'::timestamp at time zone 'America/Toronto'), 2.5, 100, 'not_started', 'manual', 'D2L / Sona',
        'Either the MKT 100 survey or the alternate written assignment. Choosing the alternate requires emailing the instructor by Sep 18.', false, null),

      (v_mkt100, 'Survey / Alt. Assignment #2', 'assignment',
        ('2026-11-23 12:00:00'::timestamp at time zone 'America/Toronto'),
        ('2026-12-01 23:59:00'::timestamp at time zone 'America/Toronto'), 2.5, 100, 'not_started', 'manual', 'D2L / Sona',
        'Eligibility requires having completed Survey / Alt. Assignment #1.', false, null),

      -- Bonus sits outside the 100% total, so weight_pct is a real 0 rather
      -- than null (null means "unknown" to lib/uni/grades.ts, which is not
      -- what this is). The 2% cannot be modelled as weight without a code
      -- change to the grade engine — recorded here so it is not forgotten.
      (v_mkt100, 'Student Research Pool (bonus)', 'participation',
        null, null, 0, 100, 'not_started', 'manual', 'Sona',
        'Up to 2% bonus, ON TOP of the 100% total. Usable in only ONE course per semester — spending it here means it is not available elsewhere.', true,
        'The grade engine has no concept of bonus weight, so this row contributes 0. Treat the up-to-2% as uncounted upside.');

    -- Weekly Metrics Mastery quizzes: 8 of them, 10% combined, all count.
    -- 1.25% each (the audit's "~1.3%" is that figure rounded).
    insert into public.uni_assessment_groups (course_id, label, drop_lowest_count)
      values (v_mkt100, 'Weekly Metrics Mastery quizzes', 0) returning id into v_grp;

    insert into public.uni_assessments
      (course_id, group_id, title, type, opens_at, due_at, weight_pct, max_score, status, source, platform, notes, needs_verification, verification_note)
    values (v_mkt100, v_grp, 'Metrics Mastery Quiz 1', 'quiz',
      ('2026-09-21 09:00:00'::timestamp at time zone 'America/Toronto'), null, 1.25, 100, 'not_started', 'manual', 'D2L',
      'Two attempts, averaged.', true,
      'Open date confirmed by announcement (Sep 21, 9:00am). Close date is stated only as "11:59pm the night before the next class" — not loaded as a date because that resolves to roughly Sep 27, and the announcement''s own wording implies a one-week window. Confirm in D2L.');

    insert into public.uni_assessments
      (course_id, group_id, title, type, opens_at, due_at, weight_pct, max_score, status, source, platform, notes, needs_verification, verification_note)
    select v_mkt100, v_grp, 'Metrics Mastery Quiz ' || n, 'quiz', null, null, 1.25, 100, 'not_started', 'manual', 'D2L',
      'Two attempts, averaged. Opens after each Monday class, due 11:59pm the night before the next one.', true,
      'Individual dates not published as of the Sept 15 audit. No quiz is due over Reading Week (Oct 12-16), so the eight quizzes do not map one-to-one onto consecutive weeks.'
    from generate_series(2, 8) as n;

    raise notice 'MKT 100 loaded: 5 graded components + 8 weekly quizzes + 1 bonus = 100%%';
  end if;

  -- ==========================================================================
  -- QMS 110 / GMS 200 — already loaded by 0035. Reconcile only.
  -- ==========================================================================

  if v_qms110 is not null then
    update public.uni_assessments set platform = 'MyLabMath'
      where course_id = v_qms110 and title like 'MyLabMath Module%';

    -- 0035 flagged this because Nov 8 2026 is a Sunday and it had one
    -- source. The audit independently confirms Nov 8, 1:00-3:00pm from both
    -- the content page and the outline, and QMS 110 is not the only course
    -- with a Sunday exam this term (MKT 100's midterm is Sunday Oct 25).
    -- Two independent sources agreeing is the bar this project uses, so the
    -- flag comes off.
    update public.uni_assessments set
      needs_verification = false,
      verification_note = null,
      platform = 'In-person',
      notes = 'Covers Weeks 1-6 / Modules 1-6. 1:00-3:00pm, 2 hours. Non-programmable calculator plus ONE page of handwritten two-sided crib notes.'
      where course_id = v_qms110 and title = 'Midterm Test 1';

    update public.uni_assessments set
      platform = 'In-person',
      notes = 'All 12 modules, 2.5 hours. TWO pages of handwritten two-sided crib notes allowed — one more than the midterm.'
      where course_id = v_qms110 and title = 'Final Exam';
  end if;

  if v_gms200 is not null then
    update public.uni_assessments set platform = 'WileyPLUS'
      where course_id = v_gms200 and title like 'WileyPLUS%';
    update public.uni_assessments set platform = 'Glo-Bus'
      where course_id = v_gms200 and title like 'Glo-Bus%';
    update public.uni_assessments set platform = 'In-person'
      where course_id = v_gms200 and title in ('Midterm Exam', 'Final Exam');
    update public.uni_assessments set platform = 'D2L'
      where course_id = v_gms200 and title = 'Mid-term Practice Questions';
  end if;
end $$;

-- ============================================================================
-- PART 6: deadlines — one missing university date, plus course-scoped ones
-- ============================================================================

-- The audit found this in the TMU calendar and 0035 does not have it.
insert into public.uni_deadlines (title, due_at, end_at, category, notes)
select 'End of Fall Term Waitlist Period',
       ('2026-09-16 12:00:00'::timestamp at time zone 'America/Toronto'), null, 'enrolment', null
where not exists (
  select 1 from public.uni_deadlines where title = 'End of Fall Term Waitlist Period'
);

do $$
declare
  v_qms110 uuid; v_gms200 uuid; v_mkt100 uuid;
begin
  select id into v_qms110 from public.uni_courses where replace(upper(code),' ','') = 'QMS110' limit 1;
  select id into v_gms200 from public.uni_courses where replace(upper(code),' ','') = 'GMS200' limit 1;
  select id into v_mkt100 from public.uni_courses where replace(upper(code),' ','') = 'MKT100' limit 1;

  -- The two unknown class times, dated before the Sep 18 add/drop cutoff so
  -- they are resolved while changing enrolment is still free.
  insert into public.uni_deadlines (course_id, title, due_at, category, notes)
  select v_qms110, 'Confirm QMS 110 lecture day, time and room (MyServiceHub)',
         ('2026-09-18 12:00:00'::timestamp at time zone 'America/Toronto'), 'other',
         'The outline says only "in person at a scheduled time in a designated room". Nothing in D2L gives the day, time or room, so QMS 110 currently has no schedule block and will not appear on the timetable until this is filled in.'
  where v_qms110 is not null
    and not exists (select 1 from public.uni_deadlines where course_id = v_qms110 and title like 'Confirm QMS 110 lecture%');

  insert into public.uni_deadlines (course_id, title, due_at, category, notes)
  select v_mkt100, 'Confirm enrolled MKT 100 section and Zoom time (MyServiceHub)',
         ('2026-09-18 12:00:00'::timestamp at time zone 'America/Toronto'), 'other',
         'The D2L shell serves five sections (121, 131, 701E, 910T, 711E) with five different Monday Zoom times, and course content does not reveal which one is enrolled. MKT 100 has no schedule block until this is resolved. Classes are Mondays only — every other time listed in the outline is independent study, not a class.'
  where v_mkt100 is not null
    and not exists (select 1 from public.uni_deadlines where course_id = v_mkt100 and title like 'Confirm enrolled MKT 100 section%');

  -- MKT 100's three email-the-instructor cutoffs. None is graded, all three
  -- have consequences, and none had anywhere to live before this migration.
  insert into public.uni_deadlines (course_id, title, due_at, category, notes)
  select v_mkt100, 'Email instructor to opt into Alt. Assignment #1 (instead of the survey)',
         ('2026-09-18 12:00:00'::timestamp at time zone 'America/Toronto'), 'other',
         'Only required if choosing the alternate written assignment over the survey. Doing nothing defaults to the survey, which opens Sep 19.'
  where v_mkt100 is not null
    and not exists (select 1 from public.uni_deadlines where course_id = v_mkt100 and title like 'Email instructor to opt into Alt.%');

  insert into public.uni_deadlines (course_id, title, due_at, category, notes)
  select v_mkt100, 'Deadline to report Respondus LockDown Browser install problems',
         ('2026-09-30 12:00:00'::timestamp at time zone 'America/Toronto'), 'other',
         'Both MKT 100 exams require Respondus. Install it and confirm it runs before this date — raising it afterwards is not accommodated.'
  where v_mkt100 is not null
    and not exists (select 1 from public.uni_deadlines where course_id = v_mkt100 and title like 'Deadline to report Respondus%');

  insert into public.uni_deadlines (course_id, title, due_at, category, notes)
  select v_mkt100, 'Deadline to report a device or battery that cannot last the 150-minute midterm',
         ('2026-10-05 12:00:00'::timestamp at time zone 'America/Toronto'), 'other',
         'The Oct 25 midterm is written on your own device and it must hold charge for 150+ minutes.'
  where v_mkt100 is not null
    and not exists (select 1 from public.uni_deadlines where course_id = v_mkt100 and title like 'Deadline to report a device%');

  -- GMS 200's hard gate: the outline says join a team by Week 4 or drop the
  -- course. Week 4 is Sep 29 - Oct 5.
  insert into public.uni_deadlines (course_id, title, due_at, category, notes)
  select v_gms200, 'Join a Glo-Bus team (or drop GMS 200)',
         ('2026-10-05 12:00:00'::timestamp at time zone 'America/Toronto'), 'other',
         'The outline states you must join a Glo-Bus team of five by Week 4 or drop the course. The Glo-Bus registration code is distributed in weeks 2-4. This gates 20% of the grade.'
  where v_gms200 is not null
    and not exists (select 1 from public.uni_deadlines where course_id = v_gms200 and title like 'Join a Glo-Bus team%');
end $$;

-- ============================================================================
-- PART 7: materials — things the audit found that are not dated work
-- ============================================================================

do $$
declare
  v_qms110 uuid; v_mkt100 uuid; v_ecn440 uuid;
begin
  select id into v_qms110 from public.uni_courses where replace(upper(code),' ','') = 'QMS110' limit 1;
  select id into v_mkt100 from public.uni_courses where replace(upper(code),' ','') = 'MKT100' limit 1;
  select id into v_ecn440 from public.uni_courses where replace(upper(code),' ','') = 'ECN440' limit 1;

  insert into public.uni_materials (course_id, title, type, body)
  select v_qms110, 'MyLabMath enrolment details', 'other',
    'Pearson MyLabMath Course ID: ruzgar11766. All graded work outside the two in-person tests runs through MyLabMath — there is no D2L dropbox or quiz for this course. Modules are weekly with a one-week window; the best 10 of 12 count. Late portions carry a 25% penalty. Grade disputes must go to Pearson support first, not the instructor. GenAI is prohibited on all graded work.'
  where v_qms110 is not null
    and not exists (select 1 from public.uni_materials where course_id = v_qms110 and title = 'MyLabMath enrolment details');

  insert into public.uni_materials (course_id, title, type, body)
  select v_mkt100, 'Two D2L data problems found in the Sept 15 audit', 'other',
    'First: the Week 2 content module carries a "Due Sep 15, 2022 11:59 PM" tag — the wrong year, almost certainly a stale template artifact left over from an earlier offering. It is not a real deadline and has not been loaded as one. Second: the SABER simulation platform named in the course title appears nowhere in Content, the Outline or Announcements, so the course seems to be running without it this term. Verify both directly with the instructor if either starts to matter.'
  where v_mkt100 is not null
    and not exists (select 1 from public.uni_materials where course_id = v_mkt100 and title like 'Two D2L data problems%');

  insert into public.uni_materials (course_id, title, type, body)
  select v_ecn440, 'Term paper brief', 'other',
    'Compare and contrast two of the nine historical financial crises covered in lectures: Tulip Mania, the South Sea Bubble, the Mississippi Bubble, Railway Mania, the Great Depression, the Latin American debt crisis, the Japanese asset bubble, the currency crises, the dot-com bubble, and the 2008-09 recession. 2,000-3,000 words, APA. Turnitin is required and only one resubmission is allowed after a failed originality check, so run it early rather than on Dec 4.'
  where v_ecn440 is not null
    and not exists (select 1 from public.uni_materials where course_id = v_ecn440 and title = 'Term paper brief');
end $$;

-- ============================================================================
-- PART 8: verification — run these after, in their own tabs
-- ============================================================================
-- Before being handed over, this file was run twice against a throwaway
-- Postgres 16 instance seeded to match the schema state left by 0021 +
-- 0032 + 0035 + 0038 (table definitions and a synthetic set of rows
-- resembling what those migrations would have produced — not a copy of
-- the real database, which was not reachable from where this was
-- written). That run confirmed the SQL is syntactically valid, every
-- insert is idempotent on a second run, ON DELETE SET NULL preserves an
-- attendance row when its schedule block is replaced, and the weight
-- totals below are arithmetically correct. It does NOT confirm anything
-- about the real Supabase database's current contents or about whether
-- the source data itself (names, emails, rooms, dates) is accurate — run
-- the checks below against the real database after applying, and verify
-- the contact details against TMU systems on your own schedule.
--
-- Expected: ECN 104, ECN 440, GMS 200 and MKT 100 each sum to exactly 100.
-- QMS 110 reads 104 naive — its 12 MyLabMath rows carry 2.0% each where
-- only the best 10 count, so the extra 4 points are the 0035 drop-lowest
-- convention working as designed, not an error.
--
--   select c.code, count(a.id) as rows, coalesce(sum(a.weight_pct),0) as naive_sum
--   from public.uni_courses c
--   left join public.uni_assessments a on a.course_id = c.id
--   group by c.code order by c.code;
--
--   -- Should return exactly one row: ECN 104 Weekly Assignment 1.
--   select c.code, a.title, a.due_at, a.weight_pct
--   from public.uni_assessments a join public.uni_courses c on c.id = a.course_id
--   where a.due_at < now() and a.status in ('not_started','in_progress')
--   order by a.due_at;
--
--   -- Should return exactly four rows: ECN 440 Mon 16:00 TRS-1147,
--   -- GMS 200 Mon 18:00 TRS2-166, ECN 104 Tue 08:10 DSQ06, ECN 440
--   -- Thu 10:00 TRS-2147. QMS 110 and MKT 100 having none is correct.
--   select c.code, b.day_of_week, b.start_time, b.end_time, b.room
--   from public.uni_schedule_blocks b join public.uni_courses c on c.id = b.course_id
--   order by b.day_of_week, b.start_time;
