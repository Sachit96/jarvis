-- Shared cross-feature daily request counter for the Gemini API. Mentor
-- chat, daily brief, weekly review, nutrition chat, voice mode, and lead
-- research all funnel through lib/ai/providers/gemini-client.ts, which
-- checks and increments this before every actual HTTP attempt (including
-- retries) — so the five features can't silently exhaust the shared
-- 500 requests/day budget between them without any one of them knowing.
create table public.gemini_usage (
  usage_date date primary key,
  request_count int not null default 0
);

-- Atomic upsert-and-return so concurrent callers (e.g. the Netlify
-- Background Function running a lead-research batch at the same time
-- someone is talking to Voice Mode) can't race each other into an
-- undercount — a single "on conflict do update ... returning" is one
-- atomic statement, no separate read-then-write.
create or replace function public.increment_gemini_usage(p_date date)
returns int
language plpgsql
as $$
declare
  new_count int;
begin
  insert into public.gemini_usage (usage_date, request_count)
  values (p_date, 1)
  on conflict (usage_date) do update set request_count = gemini_usage.request_count + 1
  returning request_count into new_count;
  return new_count;
end;
$$;

-- Same divergence from the rest of the schema as lead_research/research_runs
-- (see 0015) — RLS enabled with zero policies, deny-all to the anon key.
-- The service-role client the app actually uses bypasses this regardless.
alter table public.gemini_usage enable row level security;
