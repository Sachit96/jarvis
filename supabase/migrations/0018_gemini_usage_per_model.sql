-- Tiered model routing (see lib/ai/providers/gemini-client.ts): the daily
-- brief, weekly review, general mentor chat, and nutrition chatbot now
-- route to gemma-4-31b-it (14,400 req/day), while the lead qualifier stays
-- on gemini-3.5-flash-lite (500 req/day) — its nested/enum response schema
-- failed 3/3 times on Gemma. One shared counter across both was always
-- wrong for this; each model needs its own independently-enforced ceiling.
--
-- Existing rows predate tiering entirely, so they're unambiguously
-- gemini-3.5-flash-lite usage — backfilled as such rather than discarded.
alter table public.gemini_usage add column model text;
update public.gemini_usage set model = 'gemini-3.5-flash-lite' where model is null;
alter table public.gemini_usage alter column model set not null;

alter table public.gemini_usage drop constraint gemini_usage_pkey;
alter table public.gemini_usage add primary key (usage_date, model);

-- create or replace can't change a function's parameter list in place
-- (Postgres would just add a second overload alongside the old one) — drop
-- the single-arg version explicitly so there's exactly one signature.
drop function if exists public.increment_gemini_usage(date);

create function public.increment_gemini_usage(p_date date, p_model text)
returns int
language plpgsql
as $$
declare
  new_count int;
begin
  insert into public.gemini_usage (usage_date, model, request_count)
  values (p_date, p_model, 1)
  on conflict (usage_date, model) do update set request_count = gemini_usage.request_count + 1
  returning request_count into new_count;
  return new_count;
end;
$$;
