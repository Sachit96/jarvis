-- Phase: Business OS — agency CRM, lead/deal pipeline, revenue & contracts,
-- and GoHighLevel v2 sync/webhooks.
-- Every table follows the RLS pattern established in 0001_init.sql.

-- ============================================================= pipeline_stages
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pipeline_stages enable row level security;
create policy "select_own_pipeline_stages" on public.pipeline_stages for select using (auth.uid() = user_id);
create policy "insert_own_pipeline_stages" on public.pipeline_stages for insert with check (auth.uid() = user_id);
create policy "update_own_pipeline_stages" on public.pipeline_stages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_pipeline_stages" on public.pipeline_stages for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.pipeline_stages
  for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================= contacts (leads/clients)
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text,
  contact_person text not null,
  email text,
  phone text,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'ghl')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contacts enable row level security;
create policy "select_own_contacts" on public.contacts for select using (auth.uid() = user_id);
create policy "insert_own_contacts" on public.contacts for insert with check (auth.uid() = user_id);
create policy "update_own_contacts" on public.contacts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_contacts" on public.contacts for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.contacts
  for each row execute procedure extensions.moddatetime(updated_at);
create unique index contacts_user_external_id_idx on public.contacts (user_id, external_id) where external_id is not null;

-- ============================================================= deals (opportunities)
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages(id),
  title text,
  value numeric(14, 2) not null default 0,
  expected_close_date date,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'ghl')),
  external_id text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deals enable row level security;
create policy "select_own_deals" on public.deals for select using (auth.uid() = user_id);
create policy "insert_own_deals" on public.deals for insert with check (auth.uid() = user_id);
create policy "update_own_deals" on public.deals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_deals" on public.deals for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.deals
  for each row execute procedure extensions.moddatetime(updated_at);
create index deals_user_stage_idx on public.deals (user_id, stage_id);
create unique index deals_user_external_id_idx on public.deals (user_id, external_id) where external_id is not null;

create or replace function public.check_deal_contact_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  contact_owner uuid;
  stage_owner uuid;
begin
  select user_id into contact_owner from public.contacts where id = NEW.contact_id;
  if contact_owner is null or contact_owner <> NEW.user_id then
    raise exception 'contact % does not belong to this user', NEW.contact_id;
  end if;
  select user_id into stage_owner from public.pipeline_stages where id = NEW.stage_id;
  if stage_owner is null or stage_owner <> NEW.user_id then
    raise exception 'pipeline stage % does not belong to this user', NEW.stage_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_deals_check_owner
  before insert or update on public.deals
  for each row execute function public.check_deal_contact_owner();

-- ============================================================= activities (interaction log)
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  type text not null default 'note' check (type in ('call', 'email', 'meeting', 'note', 'other')),
  notes text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.activities enable row level security;
create policy "select_own_activities" on public.activities for select using (auth.uid() = user_id);
create policy "insert_own_activities" on public.activities for insert with check (auth.uid() = user_id);
create policy "update_own_activities" on public.activities for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_activities" on public.activities for delete using (auth.uid() = user_id);
create index activities_user_contact_idx on public.activities (user_id, contact_id, occurred_at desc);

create or replace function public.check_activity_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  contact_owner uuid;
  deal_owner uuid;
begin
  select user_id into contact_owner from public.contacts where id = NEW.contact_id;
  if contact_owner is null or contact_owner <> NEW.user_id then
    raise exception 'contact % does not belong to this user', NEW.contact_id;
  end if;
  if NEW.deal_id is not null then
    select user_id into deal_owner from public.deals where id = NEW.deal_id;
    if deal_owner is null or deal_owner <> NEW.user_id then
      raise exception 'deal % does not belong to this user', NEW.deal_id;
    end if;
  end if;
  return NEW;
end;
$$;

create trigger trg_activities_check_owner
  before insert or update on public.activities
  for each row execute function public.check_activity_owner();

-- ============================================================= deal_tasks (deal reminders)
create table public.deal_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  title text not null,
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deal_tasks enable row level security;
create policy "select_own_deal_tasks" on public.deal_tasks for select using (auth.uid() = user_id);
create policy "insert_own_deal_tasks" on public.deal_tasks for insert with check (auth.uid() = user_id);
create policy "update_own_deal_tasks" on public.deal_tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_deal_tasks" on public.deal_tasks for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.deal_tasks
  for each row execute procedure extensions.moddatetime(updated_at);
create index deal_tasks_user_deal_idx on public.deal_tasks (user_id, deal_id);

create or replace function public.check_deal_task_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  deal_owner uuid;
begin
  select user_id into deal_owner from public.deals where id = NEW.deal_id;
  if deal_owner is null or deal_owner <> NEW.user_id then
    raise exception 'deal % does not belong to this user', NEW.deal_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_deal_tasks_check_owner
  before insert or update on public.deal_tasks
  for each row execute function public.check_deal_task_owner();

-- ============================================================= contracts (retainers / MRR)
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  title text not null,
  monthly_value numeric(14, 2) not null default 0,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  start_date date not null default current_date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contracts enable row level security;
create policy "select_own_contracts" on public.contracts for select using (auth.uid() = user_id);
create policy "insert_own_contracts" on public.contracts for insert with check (auth.uid() = user_id);
create policy "update_own_contracts" on public.contracts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_contracts" on public.contracts for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.contracts
  for each row execute procedure extensions.moddatetime(updated_at);
create index contracts_user_status_idx on public.contracts (user_id, status);

create or replace function public.check_contract_contact_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  contact_owner uuid;
begin
  select user_id into contact_owner from public.contacts where id = NEW.contact_id;
  if contact_owner is null or contact_owner <> NEW.user_id then
    raise exception 'contact % does not belong to this user', NEW.contact_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_contracts_check_owner
  before insert or update on public.contracts
  for each row execute function public.check_contract_contact_owner();

-- ============================================================= client_onboarding_tasks
create table public.client_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_onboarding_tasks enable row level security;
create policy "select_own_client_onboarding_tasks" on public.client_onboarding_tasks for select using (auth.uid() = user_id);
create policy "insert_own_client_onboarding_tasks" on public.client_onboarding_tasks for insert with check (auth.uid() = user_id);
create policy "update_own_client_onboarding_tasks" on public.client_onboarding_tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_client_onboarding_tasks" on public.client_onboarding_tasks for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.client_onboarding_tasks
  for each row execute procedure extensions.moddatetime(updated_at);
create index onboarding_tasks_user_contact_idx on public.client_onboarding_tasks (user_id, contact_id);

create or replace function public.check_onboarding_task_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  contact_owner uuid;
begin
  select user_id into contact_owner from public.contacts where id = NEW.contact_id;
  if contact_owner is null or contact_owner <> NEW.user_id then
    raise exception 'contact % does not belong to this user', NEW.contact_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_onboarding_tasks_check_owner
  before insert or update on public.client_onboarding_tasks
  for each row execute function public.check_onboarding_task_owner();

-- ============================================================= ghl_connections (one per user)
create table public.ghl_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  private_token text not null,
  location_id text not null,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.ghl_connections enable row level security;
create policy "select_own_ghl_connections" on public.ghl_connections for select using (auth.uid() = user_id);
create policy "insert_own_ghl_connections" on public.ghl_connections for insert with check (auth.uid() = user_id);
create policy "update_own_ghl_connections" on public.ghl_connections for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_ghl_connections" on public.ghl_connections for delete using (auth.uid() = user_id);
create trigger set_updated_at before update on public.ghl_connections
  for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================= ghl_sync_logs
create table public.ghl_sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  event_type text not null,
  status text not null check (status in ('success', 'error')),
  message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.ghl_sync_logs enable row level security;
create policy "select_own_ghl_sync_logs" on public.ghl_sync_logs for select using (auth.uid() = user_id);
create policy "insert_own_ghl_sync_logs" on public.ghl_sync_logs for insert with check (auth.uid() = user_id);
create policy "delete_own_ghl_sync_logs" on public.ghl_sync_logs for delete using (auth.uid() = user_id);
create index ghl_sync_logs_user_created_idx on public.ghl_sync_logs (user_id, created_at desc);
