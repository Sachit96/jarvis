-- Health OS extension: real weight and sleep tracking (previously
-- placeholder-only /health/body). No user_id/RLS — matches every table
-- created since 0012_remove_auth.sql (JARVIS is single-user).

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  logged_at date not null default current_date,
  weight_kg numeric(6, 2) not null check (weight_kg > 0),
  body_fat_pct numeric(4, 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (logged_at)
);

create trigger set_updated_at before update on public.body_metrics
  for each row execute procedure extensions.moddatetime(updated_at);
create index body_metrics_logged_at_idx on public.body_metrics (logged_at desc);

create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null default current_date,
  hours_slept numeric(4, 2) not null check (hours_slept >= 0 and hours_slept <= 24),
  quality int check (quality between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (log_date)
);

create trigger set_updated_at before update on public.sleep_logs
  for each row execute procedure extensions.moddatetime(updated_at);
create index sleep_logs_log_date_idx on public.sleep_logs (log_date desc);
