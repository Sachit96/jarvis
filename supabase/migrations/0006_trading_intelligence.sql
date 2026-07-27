-- Phase 4: Command Center & Trading Intelligence OS — top-down market
-- analysis, pre-trade confluence checklist, and a gate column on trades.
-- Every table follows the RLS pattern established in 0001_init.sql.

-- ============================================================= market_analyses (top-down analysis per pair/date)
create table public.market_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pair text not null,
  analysis_date date not null default current_date,
  weekly_sentiment text check (weekly_sentiment in ('bullish', 'bearish', 'choppy')),
  weekly_notes text,
  daily_sentiment text check (daily_sentiment in ('bullish', 'bearish', 'choppy')),
  daily_notes text,
  h4_sentiment text check (h4_sentiment in ('bullish', 'bearish', 'choppy')),
  h4_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pair, analysis_date)
);

alter table public.market_analyses enable row level security;
create policy "select_own_market_analyses" on public.market_analyses for select using (auth.uid() = user_id);
create policy "insert_own_market_analyses" on public.market_analyses for insert with check (auth.uid() = user_id);
create policy "update_own_market_analyses" on public.market_analyses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_market_analyses" on public.market_analyses for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.market_analyses
  for each row execute procedure extensions.moddatetime(updated_at);
create index market_analyses_user_date_idx on public.market_analyses (user_id, analysis_date desc);

-- ============================================================= trade_checklist_items (customizable pre-trade confluence checklist)
create table public.trade_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trade_checklist_items enable row level security;
create policy "select_own_trade_checklist_items" on public.trade_checklist_items for select using (auth.uid() = user_id);
create policy "insert_own_trade_checklist_items" on public.trade_checklist_items for insert with check (auth.uid() = user_id);
create policy "update_own_trade_checklist_items" on public.trade_checklist_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_trade_checklist_items" on public.trade_checklist_items for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.trade_checklist_items
  for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================= trades: pre-trade confluence gate
alter table public.trades add column confluence_checked boolean not null default false;
