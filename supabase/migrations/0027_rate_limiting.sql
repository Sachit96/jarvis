-- Security hardening (Session 2, Phase 2). A generic, DB-backed rate
-- limiter — not in-memory, because Netlify's serverless functions don't
-- share memory across invocations (or even reliably across requests to
-- the "same" warm instance), so an in-memory counter would silently not
-- limit anything in production. One row per gated call; the limiter
-- counts recent rows for a given route rather than maintaining a running
-- counter, same shape as sms_messages' existing rate guard.
create table public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_route_created_idx on public.rate_limit_events (route, created_at desc);

-- Same divergence from the pre-0012 schema as every table since — RLS
-- enabled with zero policies, deny-all to the anon key.
alter table public.rate_limit_events enable row level security;
