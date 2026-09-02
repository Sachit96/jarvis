-- ⚠️ NOT part of the standard migration sequence — do not run this
-- automatically along with 0021-0028. This is destructive (drops two
-- tables and their data permanently) and was written specifically so
-- it's ready WHEN you decide to run it, not as a default action. See the
-- Session 2 morning report for the reasoning: prayers/prayer_logs have
-- had no UI or actions since "Pray to God" became a Daily Routine item
-- (migration 0011). If you still have data in these tables you want
-- first, export it (the JSON backup at /settings includes both) before
-- running this.
drop table if exists public.prayer_logs;
drop table if exists public.prayers;
