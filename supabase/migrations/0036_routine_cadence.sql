-- Routine cadence.
--
-- Habits were implicitly daily: habit_logs carries one row per habit per
-- day, and nothing recorded how often the habit was MEANT to happen. A
-- weekly routine ("Sunday planning") was therefore inexpressible — it read
-- as missed six days in seven and destroyed the streak.
--
-- This is the smallest schema that fixes that, and deliberately not a
-- general recurrence rule: nothing in JARVIS needs "every third Tuesday",
-- and an unused general mechanism is harder to reason about than the
-- specific one actually in use.
--
-- Both columns are additive with defaults, so every existing habit keeps
-- behaving exactly as it does today (daily, due every day) with no backfill.

alter table public.habits
  add column cadence text not null default 'daily'
    check (cadence in ('daily', 'weekly'));

-- 0 = Sunday .. 6 = Saturday, matching JavaScript's Date#getDay so the
-- client needs no translation layer. Empty for daily habits; for a weekly
-- habit an empty array means "not configured yet", which the UI surfaces
-- rather than silently treating as daily.
alter table public.habits
  add column days_of_week int[] not null default '{}';

-- Guards the two ways this can go wrong: a day index that is not a real
-- weekday, and a daily habit carrying weekday data that nothing reads.
alter table public.habits
  add constraint habits_days_of_week_valid check (
    (cadence = 'daily' and days_of_week = '{}')
    or (cadence = 'weekly' and days_of_week <@ '{0,1,2,3,4,5,6}'::int[])
  );
