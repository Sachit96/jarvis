-- Anthropic provider (Work Order 6) — the only paid path in this app.
-- Anthropic has no ongoing free tier (a one-time trial credit, then
-- pay-per-token), unlike every Gemini tier this app otherwise uses, so
-- spend is tracked in real dollars per call (computed from actual token
-- counts x the per-model rate, not a request-count proxy) against a
-- lifetime cap — not a daily-resetting budget like gemini_usage, since
-- there's no renewing free quota to reset against.
create table public.anthropic_usage (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  input_tokens int not null,
  output_tokens int not null,
  cost_usd numeric(10,4) not null,
  incurred_at timestamptz not null default now()
);
create index anthropic_usage_incurred_idx on public.anthropic_usage (incurred_at desc);
alter table public.anthropic_usage enable row level security;

-- Single-row settings table, same "true one-row table" pattern as
-- nutrition_targets/ghl_connections (fetched by presence, not by id) —
-- the `id boolean primary key default true check (id)` trick enforces
-- exactly one row ever existing.
create table public.anthropic_settings (
  id boolean primary key default true check (id),
  spend_cap_usd numeric(10,2) not null default 3.00
);
insert into public.anthropic_settings (id) values (true);
alter table public.anthropic_settings enable row level security;
