-- Daily Routine: extends the existing Habits feature (per user's explicit
-- choice) rather than duplicating it with a parallel table. Adds ordering/
-- pinning for the checklist UI and an explicit completion timestamp.
alter table public.habits add column sort_order int not null default 0;
alter table public.habits add column pinned boolean not null default false;
alter table public.habit_logs add column completed_at timestamptz;
