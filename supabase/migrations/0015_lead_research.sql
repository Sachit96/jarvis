-- Lead Research Agent: discovers local businesses (Google Places), audits
-- their web presence, scores the opportunity via LLM, and inserts them into
-- the existing Business -> Pipeline (contacts + deals) as source =
-- 'research_agent' rows — not a parallel CRM. Research-specific fields live
-- in a linked lead_research table rather than bloating contacts/deals with
-- ~14 columns that are NULL for every manually-added or GHL-synced lead.

-- Widen both source enums to admit the new origin.
alter table public.contacts drop constraint contacts_source_check;
alter table public.contacts add constraint contacts_source_check
  check (source in ('manual', 'ghl', 'research_agent'));

alter table public.deals drop constraint deals_source_check;
alter table public.deals add constraint deals_source_check
  check (source in ('manual', 'ghl', 'research_agent'));

-- ============================================================= lead_research
create table public.lead_research (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,

  google_place_id text not null unique,
  maps_url text,
  industry text,
  city text,
  region text,
  country text,
  postal_code text,

  rating numeric(2, 1),
  review_count int,

  audit jsonb not null default '{}'::jsonb,
  score int not null check (score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  opportunities text[] not null default '{}',
  ai_summary text,

  dismissed boolean not null default false,
  researched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_research_contact_idx on public.lead_research (contact_id);
create index lead_research_score_idx on public.lead_research (score desc);
create index lead_research_researched_idx on public.lead_research (researched_at desc);
-- GIN index for the opportunity-tag filter on the results table.
create index lead_research_opportunities_idx on public.lead_research using gin (opportunities);

create trigger set_updated_at before update on public.lead_research
  for each row execute procedure extensions.moddatetime(updated_at);

-- ============================================================= research_runs
create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  params jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  found_count int not null default 0,
  audited_count int not null default 0,
  inserted_count int not null default 0,
  skipped_cached_count int not null default 0,
  failed_count int not null default 0,
  current_label text,
  error_log jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index research_runs_status_idx on public.research_runs (status);
create index research_runs_created_idx on public.research_runs (created_at desc);

-- ============================================================================
-- RLS: deliberate divergence from the rest of this schema. Every other table
-- had RLS dropped project-wide in 0012_remove_auth (single dataset, no
-- sessions, every server query already runs through the service-role client,
-- which bypasses RLS regardless of policies). These two tables enable RLS
-- with zero policies — an intentional deny-all to the anon key specifically
-- — because they're the first surface in this app that talks to paid,
-- rate-limited external APIs (Places/PageSpeed/Gemini) on the user's behalf,
-- and the anon key is the one credential a client-side leak could expose.
-- The app's own access is unaffected: lib/supabase/server.ts and admin.ts
-- both use SUPABASE_SERVICE_ROLE_KEY, which is not subject to RLS.
-- ============================================================================
alter table public.lead_research enable row level security;
alter table public.research_runs enable row level security;
