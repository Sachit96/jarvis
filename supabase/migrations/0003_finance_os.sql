-- Phase 2: Finance OS — accounts, transactions, budgets, trades.
-- Every table follows the RLS pattern established in 0001_init.sql.

-- ============================================================= accounts
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('cash', 'savings', 'credit', 'investment')),
  current_balance numeric(14, 2) not null default 0,
  is_liability boolean generated always as (account_type = 'credit') stored,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
create policy "select_own_accounts" on public.accounts for select using (auth.uid() = user_id);
create policy "insert_own_accounts" on public.accounts for insert with check (auth.uid() = user_id);
create policy "update_own_accounts" on public.accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_accounts" on public.accounts for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.accounts
  for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================= transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14, 2) not null check (amount > 0),
  category text not null,
  description text,
  occurred_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
create policy "select_own_transactions" on public.transactions for select using (auth.uid() = user_id);
create policy "insert_own_transactions" on public.transactions for insert with check (auth.uid() = user_id);
create policy "update_own_transactions" on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_transactions" on public.transactions for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.transactions
  for each row execute procedure extensions.moddatetime(updated_at);
create index transactions_user_occurred_idx on public.transactions (user_id, occurred_at desc);
create index transactions_user_account_idx on public.transactions (user_id, account_id);
create index transactions_user_category_idx on public.transactions (user_id, category);

-- Keep account balances in sync with their transactions (real-time balance updates).
-- security definer so the balance update isn't blocked by the acting row's own RLS context.
create or replace function public.apply_transaction_delta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update public.accounts
      set current_balance = current_balance + (case when NEW.type = 'income' then NEW.amount else -NEW.amount end)
      where id = NEW.account_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.accounts
      set current_balance = current_balance - (case when OLD.type = 'income' then OLD.amount else -OLD.amount end)
      where id = OLD.account_id;
    return OLD;
  elsif TG_OP = 'UPDATE' then
    update public.accounts
      set current_balance = current_balance - (case when OLD.type = 'income' then OLD.amount else -OLD.amount end)
      where id = OLD.account_id;
    update public.accounts
      set current_balance = current_balance + (case when NEW.type = 'income' then NEW.amount else -NEW.amount end)
      where id = NEW.account_id;
    return NEW;
  end if;
  return null;
end;
$$;

create trigger trg_transactions_balance
  after insert or update or delete on public.transactions
  for each row execute function public.apply_transaction_delta();

-- ============================================================= budgets (monthly cap per category)
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  monthly_limit numeric(14, 2) not null check (monthly_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);

alter table public.budgets enable row level security;
create policy "select_own_budgets" on public.budgets for select using (auth.uid() = user_id);
create policy "insert_own_budgets" on public.budgets for insert with check (auth.uid() = user_id);
create policy "update_own_budgets" on public.budgets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_budgets" on public.budgets for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.budgets
  for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================= trades (trading & venture journal)
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_pair text not null,
  direction text not null check (direction in ('long', 'short')),
  entry_price numeric(18, 8) not null,
  exit_price numeric(18, 8),
  quantity numeric(18, 8),
  fees numeric(14, 2) not null default 0,
  pnl numeric(14, 2),
  setup_category text,
  notes text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trades enable row level security;
create policy "select_own_trades" on public.trades for select using (auth.uid() = user_id);
create policy "insert_own_trades" on public.trades for insert with check (auth.uid() = user_id);
create policy "update_own_trades" on public.trades for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_trades" on public.trades for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.trades
  for each row execute procedure extensions.moddatetime(updated_at);
create index trades_user_opened_idx on public.trades (user_id, opened_at desc);
create index trades_user_status_idx on public.trades (user_id, status);
