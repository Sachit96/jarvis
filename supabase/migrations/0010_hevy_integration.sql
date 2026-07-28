-- Hevy API integration: tag workouts/exercises pulled from Hevy so synced
-- rows can be upserted idempotently and distinguished from manual entries.
-- Plain unique constraints (not partial indexes) per the lesson learned in
-- migration 0008 — Supabase's .upsert({onConflict}) emits a plain
-- ON CONFLICT with no WHERE clause, which can't target a partial index.

alter table public.workouts add column source text not null default 'manual' check (source in ('manual', 'hevy'));
alter table public.workouts add column external_id text;
alter table public.workouts add constraint workouts_user_external_id_key unique (user_id, external_id);

alter table public.exercises add column source text not null default 'manual' check (source in ('manual', 'hevy'));
alter table public.exercises add column external_id text;
alter table public.exercises add constraint exercises_user_external_id_key unique (user_id, external_id);
