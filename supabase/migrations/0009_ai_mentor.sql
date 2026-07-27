-- Phase 5: AI Mentor — daily recommendations and weekly reviews.
-- mentor_messages (Phase 3, migration 0005) already backs the chat for both
-- the nutrition context and this general 'mentor' context.
-- Every table follows the RLS pattern established in 0001_init.sql.

-- ============================================================= daily_recommendations
create table public.daily_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rec_date date not null default current_date,
  markdown_body text not null,
  focus_areas text[] not null default '{}',
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  model_used text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, rec_date)
);

alter table public.daily_recommendations enable row level security;
create policy "select_own_daily_recommendations" on public.daily_recommendations for select using (auth.uid() = user_id);
create policy "insert_own_daily_recommendations" on public.daily_recommendations for insert with check (auth.uid() = user_id);
create policy "update_own_daily_recommendations" on public.daily_recommendations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_daily_recommendations" on public.daily_recommendations for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.daily_recommendations
  for each row execute procedure extensions.moddatetime(updated_at);
create index daily_recommendations_user_date_idx on public.daily_recommendations (user_id, rec_date desc);

-- ============================================================= weekly_reviews
create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  week_end_date date not null,
  markdown_body text not null,
  focus_areas text[] not null default '{}',
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  model_used text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

alter table public.weekly_reviews enable row level security;
create policy "select_own_weekly_reviews" on public.weekly_reviews for select using (auth.uid() = user_id);
create policy "insert_own_weekly_reviews" on public.weekly_reviews for insert with check (auth.uid() = user_id);
create policy "update_own_weekly_reviews" on public.weekly_reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_weekly_reviews" on public.weekly_reviews for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.weekly_reviews
  for each row execute procedure extensions.moddatetime(updated_at);
create index weekly_reviews_user_week_idx on public.weekly_reviews (user_id, week_start_date desc);
