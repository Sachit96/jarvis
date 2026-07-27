-- Phase 3: Health & Fitness OS — workouts (+ exercises/sets), nutrition
-- (targets/logs/water), and the AI Mentor's chat history.
-- Every table follows the RLS pattern established in 0001_init.sql.

-- ============================================================= exercises (per-user custom list)
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exercises enable row level security;
create policy "select_own_exercises" on public.exercises for select using (auth.uid() = user_id);
create policy "insert_own_exercises" on public.exercises for insert with check (auth.uid() = user_id);
create policy "update_own_exercises" on public.exercises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_exercises" on public.exercises for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.exercises
  for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================= workouts (one row per training session)
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_label text not null default 'Session',
  started_at timestamptz not null default now(),
  completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workouts enable row level security;
create policy "select_own_workouts" on public.workouts for select using (auth.uid() = user_id);
create policy "insert_own_workouts" on public.workouts for insert with check (auth.uid() = user_id);
create policy "update_own_workouts" on public.workouts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_workouts" on public.workouts for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.workouts
  for each row execute procedure extensions.moddatetime(updated_at);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);

-- ============================================================= workout_sets
create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  set_number int not null default 1,
  weight_kg numeric(6, 2),
  reps int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workout_sets enable row level security;
create policy "select_own_workout_sets" on public.workout_sets for select using (auth.uid() = user_id);
create policy "insert_own_workout_sets" on public.workout_sets for insert with check (auth.uid() = user_id);
create policy "update_own_workout_sets" on public.workout_sets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_workout_sets" on public.workout_sets for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.workout_sets
  for each row execute procedure extensions.moddatetime(updated_at);
create index workout_sets_user_workout_idx on public.workout_sets (user_id, workout_id);

-- A set's exercise_id and workout_id must belong to the same user as the set
-- itself — RLS only checks the set row's own user_id, not its foreign keys.
create or replace function public.check_workout_set_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  workout_owner uuid;
  exercise_owner uuid;
begin
  select user_id into workout_owner from public.workouts where id = NEW.workout_id;
  select user_id into exercise_owner from public.exercises where id = NEW.exercise_id;
  if workout_owner is null or workout_owner <> NEW.user_id then
    raise exception 'workout % does not belong to this user', NEW.workout_id;
  end if;
  if exercise_owner is null or exercise_owner <> NEW.user_id then
    raise exception 'exercise % does not belong to this user', NEW.exercise_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_workout_sets_check_owner
  before insert or update on public.workout_sets
  for each row execute function public.check_workout_set_owner();

-- ============================================================= nutrition_targets (one row per user)
create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_calories int not null default 2000,
  target_protein_g int not null default 150,
  target_carbs_g int not null default 200,
  target_fat_g int not null default 65,
  target_water_ml int not null default 2500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.nutrition_targets enable row level security;
create policy "select_own_nutrition_targets" on public.nutrition_targets for select using (auth.uid() = user_id);
create policy "insert_own_nutrition_targets" on public.nutrition_targets for insert with check (auth.uid() = user_id);
create policy "update_own_nutrition_targets" on public.nutrition_targets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_nutrition_targets" on public.nutrition_targets for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.nutrition_targets
  for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================= nutrition_logs
create table public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  logged_at date not null default current_date,
  description text not null,
  calories int not null default 0,
  protein_g numeric(6, 1) not null default 0,
  carbs_g numeric(6, 1) not null default 0,
  fat_g numeric(6, 1) not null default 0,
  source text not null default 'manual' check (source in ('manual', 'chatbot')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_logs enable row level security;
create policy "select_own_nutrition_logs" on public.nutrition_logs for select using (auth.uid() = user_id);
create policy "insert_own_nutrition_logs" on public.nutrition_logs for insert with check (auth.uid() = user_id);
create policy "update_own_nutrition_logs" on public.nutrition_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_nutrition_logs" on public.nutrition_logs for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.nutrition_logs
  for each row execute procedure extensions.moddatetime(updated_at);
create index nutrition_logs_user_date_idx on public.nutrition_logs (user_id, logged_at desc);

-- ============================================================= water_logs (additive entries per day)
create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  amount_ml int not null check (amount_ml > 0),
  created_at timestamptz not null default now()
);

alter table public.water_logs enable row level security;
create policy "select_own_water_logs" on public.water_logs for select using (auth.uid() = user_id);
create policy "insert_own_water_logs" on public.water_logs for insert with check (auth.uid() = user_id);
create policy "update_own_water_logs" on public.water_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_water_logs" on public.water_logs for delete using (auth.uid() = user_id);
create index water_logs_user_date_idx on public.water_logs (user_id, log_date);

-- ============================================================= mentor_messages (AI chat history)
create table public.mentor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  context text not null default 'nutrition' check (context in ('nutrition', 'mentor')),
  created_at timestamptz not null default now()
);

alter table public.mentor_messages enable row level security;
create policy "select_own_mentor_messages" on public.mentor_messages for select using (auth.uid() = user_id);
create policy "insert_own_mentor_messages" on public.mentor_messages for insert with check (auth.uid() = user_id);
create policy "delete_own_mentor_messages" on public.mentor_messages for delete using (auth.uid() = user_id);
create index mentor_messages_user_context_idx on public.mentor_messages (user_id, context, created_at);
