-- Phase 1: Life OS — tasks, goals, habits (+ logs), journal, prayer (+ logs).
-- Every table follows the RLS pattern established in 0001_init.sql.

-- ============================================================= tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  tags text[] not null default '{}',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
create policy "select_own_tasks" on public.tasks for select using (auth.uid() = user_id);
create policy "insert_own_tasks" on public.tasks for insert with check (auth.uid() = user_id);
create policy "update_own_tasks" on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_tasks" on public.tasks for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.tasks
  for each row execute procedure extensions.moddatetime(updated_at);
create index tasks_user_due_idx on public.tasks (user_id, due_date);

-- ============================================================= goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  timeframe text not null check (timeframe in ('daily', 'weekly', 'monthly')),
  category text,
  target_date date,
  progress_percent int not null default 0 check (progress_percent between 0 and 100),
  status text not null default 'active' check (status in ('active', 'achieved', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;
create policy "select_own_goals" on public.goals for select using (auth.uid() = user_id);
create policy "insert_own_goals" on public.goals for insert with check (auth.uid() = user_id);
create policy "update_own_goals" on public.goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_goals" on public.goals for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.goals
  for each row execute procedure extensions.moddatetime(updated_at);
create index goals_user_timeframe_idx on public.goals (user_id, timeframe);

-- ============================================================= habits
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  metric_type text not null default 'custom'
    check (metric_type in ('sleep', 'focus', 'training', 'screen_time', 'consistency', 'no_g', 'custom')),
  kind text not null default 'boolean' check (kind in ('boolean', 'count')),
  target_count int,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.habits enable row level security;
create policy "select_own_habits" on public.habits for select using (auth.uid() = user_id);
create policy "insert_own_habits" on public.habits for insert with check (auth.uid() = user_id);
create policy "update_own_habits" on public.habits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_habits" on public.habits for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.habits
  for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================= habit_logs
create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null,
  completed boolean not null default false,
  count int,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

alter table public.habit_logs enable row level security;
create policy "select_own_habit_logs" on public.habit_logs for select using (auth.uid() = user_id);
create policy "insert_own_habit_logs" on public.habit_logs for insert with check (auth.uid() = user_id);
create policy "update_own_habit_logs" on public.habit_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_habit_logs" on public.habit_logs for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.habit_logs
  for each row execute procedure extensions.moddatetime(updated_at);
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

-- ============================================================= journal_entries
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text not null,
  mood int check (mood between 1 and 5),
  entry_type text not null default 'reflection' check (entry_type in ('reflection', 'freeform', 'gratitude')),
  linked_goal_ids uuid[] not null default '{}',
  entry_date date not null default current_date,
  obsidian_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.journal_entries enable row level security;
create policy "select_own_journal_entries" on public.journal_entries for select using (auth.uid() = user_id);
create policy "insert_own_journal_entries" on public.journal_entries for insert with check (auth.uid() = user_id);
create policy "update_own_journal_entries" on public.journal_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_journal_entries" on public.journal_entries for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.journal_entries
  for each row execute procedure extensions.moddatetime(updated_at);
create index journal_entries_user_date_idx on public.journal_entries (user_id, entry_date desc);

-- ============================================================= prayers (reference list, per-user)
create table public.prayers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prayers enable row level security;
create policy "select_own_prayers" on public.prayers for select using (auth.uid() = user_id);
create policy "insert_own_prayers" on public.prayers for insert with check (auth.uid() = user_id);
create policy "update_own_prayers" on public.prayers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_prayers" on public.prayers for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.prayers
  for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================= prayer_logs
create table public.prayer_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prayer_id uuid not null references public.prayers(id) on delete cascade,
  log_date date not null,
  completed boolean not null default false,
  logged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prayer_id, log_date)
);

alter table public.prayer_logs enable row level security;
create policy "select_own_prayer_logs" on public.prayer_logs for select using (auth.uid() = user_id);
create policy "insert_own_prayer_logs" on public.prayer_logs for insert with check (auth.uid() = user_id);
create policy "update_own_prayer_logs" on public.prayer_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_prayer_logs" on public.prayer_logs for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.prayer_logs
  for each row execute procedure extensions.moddatetime(updated_at);
create index prayer_logs_user_date_idx on public.prayer_logs (user_id, log_date);
