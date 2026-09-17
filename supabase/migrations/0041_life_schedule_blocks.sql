-- Personal weekly schedule.
--
-- The existing "Routine" feature (habits + habit_logs, cadence added in
-- 0036) is a checklist: done or not-done, once a day. It cannot express
-- "gym from 9:00 to 10:30" — a time-blocked recurring commitment — and
-- was never meant to; it answers "did I do this today", not "where am I
-- right now". uni_schedule_blocks already answers the second question for
-- class time. This is that same shape (day_of_week/start_time/end_time),
-- generalized to the rest of the week: self-care, commute, gym, deep-work
-- blocks, meals, personal time.
--
-- Class time is deliberately NOT duplicated in here. uni_schedule_blocks
-- already feeds attendance, the risk score and the grade dashboard — a
-- second copy of "QMS 110, Monday, 8am" would be exactly the "second,
-- possibly-conflicting source of truth" lib/db/queries/routine.ts's own
-- doc comment already warns against for auto-derived items. The weekly
-- view merges both tables at the query layer instead (see
-- lib/db/queries/life-schedule.ts).

create table public.life_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  -- 0 = Sunday .. 6 = Saturday, matching JS Date#getDay(), same convention
  -- as uni_schedule_blocks and habits.days_of_week.
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  label text not null,
  category text not null check (category in ('self_care', 'commute', 'deep_work', 'gym', 'meal', 'personal')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.life_schedule_blocks
  for each row execute function extensions.moddatetime(updated_at);

-- Same divergence as every table since 0012 (auth removed): RLS enabled,
-- zero policies — deny-all to the anon key, service-role only.
alter table public.life_schedule_blocks enable row level security;

-- Seed: the standing week as given directly by the user on 2026-09-17.
-- Guarded so this migration is safe to re-run — it only seeds an empty
-- table, never duplicates rows on a second pass.
do $$
begin
  if not exists (select 1 from public.life_schedule_blocks) then
    insert into public.life_schedule_blocks (day_of_week, start_time, end_time, label, category) values
      -- Monday = 1 (toughest day — out from 7am to 9pm, gym at night)
      (1, '06:00', '06:15', 'Shake + vitamins', 'self_care'),
      (1, '06:15', '06:45', 'Shower + morning skincare', 'self_care'),
      (1, '06:45', '07:00', 'Head out (1hr commute)', 'commute'),
      (1, '10:00', '12:00', 'On Radar (on campus)', 'deep_work'),
      (1, '12:00', '13:00', 'Lunch (high protein)', 'meal'),
      (1, '15:00', '16:00', 'On Radar', 'deep_work'),
      (1, '17:00', '19:00', 'On Radar / dinner', 'deep_work'),
      (1, '20:00', '21:00', 'Commute home', 'commute'),
      (1, '21:00', '22:30', 'Gym (1.5 hrs)', 'gym'),
      (1, '22:30', '23:00', 'Electrolytes, shower, evening skincare', 'self_care'),

      -- Tuesday = 2
      (2, '06:00', '06:15', 'Shake + vitamins', 'self_care'),
      (2, '06:15', '06:45', 'Shower + skincare', 'self_care'),
      (2, '06:45', '07:00', 'Head out', 'commute'),
      (2, '10:00', '11:00', 'Commute home', 'commute'),
      (2, '11:00', '12:30', 'Gym', 'gym'),
      (2, '12:30', '13:15', 'Lunch (high protein)', 'meal'),
      (2, '13:15', '17:00', 'On Radar (deep work)', 'deep_work'),
      (2, '17:00', '21:00', 'Dinner / personal / light On Radar', 'personal'),
      (2, '21:00', '21:30', 'Electrolytes, shower, evening skincare', 'self_care'),

      -- Wednesday = 3 (no classes)
      (3, '06:00', '06:15', 'Shake + vitamins', 'self_care'),
      (3, '06:15', '07:45', 'Gym', 'gym'),
      (3, '07:45', '08:15', 'Shower + skincare', 'self_care'),
      (3, '08:15', '12:00', 'On Radar', 'deep_work'),
      (3, '12:00', '13:00', 'Lunch', 'meal'),
      (3, '13:00', '17:00', 'On Radar', 'deep_work'),
      (3, '17:00', '21:00', 'Personal/rest', 'personal'),
      (3, '21:00', '21:30', 'Evening routine', 'self_care'),

      -- Thursday = 4 (10am class — full morning first)
      (4, '06:00', '06:15', 'Shake + vitamins', 'self_care'),
      (4, '06:15', '07:45', 'Gym', 'gym'),
      (4, '07:45', '08:15', 'Shower + skincare', 'self_care'),
      (4, '08:15', '09:00', 'On Radar / buffer', 'deep_work'),
      (4, '09:00', '10:00', 'Head out', 'commute'),
      (4, '13:00', '17:00', 'On Radar', 'deep_work'),
      (4, '17:00', '21:00', 'Personal/dinner', 'personal'),
      (4, '21:00', '21:30', 'Evening routine', 'self_care'),

      -- Friday = 5 (no classes)
      (5, '06:00', '06:15', 'Shake + vitamins', 'self_care'),
      (5, '06:15', '07:45', 'Gym', 'gym'),
      (5, '07:45', '08:15', 'Shower + skincare', 'self_care'),
      (5, '08:15', '12:00', 'On Radar', 'deep_work'),
      (5, '13:00', '16:00', 'On Radar', 'deep_work'),
      (5, '16:00', '21:00', 'Personal time — protect this', 'personal'),
      (5, '21:00', '21:30', 'Evening routine', 'self_care'),

      -- Saturday = 6 (MKT 100 review — see note below on why this is not
      -- loaded as a second live class)
      (6, '06:00', '06:15', 'Shake + vitamins', 'self_care'),
      (6, '06:15', '07:45', 'Gym', 'gym'),
      (6, '07:45', '08:15', 'Shower + skincare', 'self_care'),
      (6, '08:15', '09:00', 'On Radar / buffer', 'deep_work'),
      (6, '09:00', '10:00', 'MKT 100 (review / independent study)', 'deep_work'),
      (6, '10:00', '12:00', 'On Radar', 'deep_work'),
      (6, '12:00', '13:00', 'Lunch (high protein)', 'meal'),
      (6, '13:00', '17:00', 'On Radar', 'deep_work'),
      (6, '17:00', '21:00', 'Personal time', 'personal'),
      (6, '21:00', '21:30', 'Electrolytes, shower, evening skincare', 'self_care'),

      -- Sunday = 0 (reset day)
      (0, '06:00', '06:15', 'Shake + vitamins', 'self_care'),
      (0, '06:15', '07:45', 'Gym', 'gym'),
      (0, '07:45', '08:15', 'Shower + skincare', 'self_care'),
      (0, '08:15', '12:00', 'On Radar — pipeline cleanup, plan the week', 'deep_work'),
      (0, '13:00', '21:00', 'Personal/rest', 'personal'),
      (0, '21:00', '21:30', 'Evening routine', 'self_care');
  end if;
end $$;

-- ============================================================================
-- Newly-confirmed class times, from the user's own stated weekly schedule.
--
-- QMS 110 and MKT 100 both left uni_schedule_blocks empty after 0040,
-- because the Sept 15 D2L audit found no published day/time for either.
-- The user has since stated their real weekly schedule directly, which is
-- treated as more authoritative than "unpublished in D2L" for a plain
-- logistics fact like a class's start time.
--
-- MKT 100's Monday 1:30-3:00pm slot is kept as a real uni_schedule_blocks
-- class row: it matches the D2L audit's explicit, confirmed statement that
-- "classes are Mondays only across all 5 sections". The Saturday 9-10am
-- MKT 100 hour in the user's routine is NOT added as a second class
-- meeting here, because that would directly contradict the audit's
-- Mondays-only fact — it's loaded above as a life_schedule_blocks
-- independent-study block instead, which is what it actually is.
--
-- ECN 104 / ECN 440 / GMS 200 are untouched: those three already carry
-- exact, D2L-audit-confirmed times in uni_schedule_blocks, and the
-- user's routine doc shows slightly rounded versions of them (e.g. GMS
-- 200 as 7-8pm vs the confirmed 6-9pm) — a personal planning grid
-- rounding to a clean hour is not grounds to overwrite a confirmed
-- official time.
do $$
declare
  v_qms110 uuid;
  v_mkt100 uuid;
begin
  select id into v_qms110 from public.uni_courses where replace(upper(code), ' ', '') = 'QMS110' limit 1;
  select id into v_mkt100 from public.uni_courses where replace(upper(code), ' ', '') = 'MKT100' limit 1;

  if v_qms110 is not null and not exists (
    select 1 from public.uni_schedule_blocks where course_id = v_qms110
  ) then
    insert into public.uni_schedule_blocks (course_id, type, day_of_week, start_time, end_time, room)
    values (v_qms110, 'lecture', 1, '08:00', '10:00', null);
    raise notice 'QMS 110: added Monday 8-10am schedule block (room still unknown)';
  end if;

  if v_mkt100 is not null and not exists (
    select 1 from public.uni_schedule_blocks where course_id = v_mkt100
  ) then
    insert into public.uni_schedule_blocks (course_id, type, day_of_week, start_time, end_time, room)
    values (v_mkt100, 'lecture', 1, '13:30', '15:00', 'Zoom');
    raise notice 'MKT 100: added Monday 1:30-3:00pm schedule block';
  end if;
end $$;

-- ============================================================================
-- Verification — run after applying.
--
--   select day_of_week, count(*) from public.life_schedule_blocks group by 1 order by 1;
--   -- Expect 10 rows on Mon, 9 on Tue, 8 on Wed, 8 on Thu, 7 on Fri, 10 on Sat, 6 on Sun.
--
--   select c.code, b.day_of_week, b.start_time, b.end_time, b.room
--   from public.uni_schedule_blocks b join public.uni_courses c on c.id = b.course_id
--   order by b.day_of_week, b.start_time;
--   -- Expect 6 rows now (was 4): QMS 110 Mon 8-10, MKT 100 Mon 1:30-3,
--   -- plus the four already-confirmed blocks from migration 0040.
