-- Follow-up watchdog (Work Order B3): "deals that haven't changed stage in
-- N days" needs a real timestamp for exactly that event — deals.updated_at
-- changes on ANY edit (value, notes, whatever), so it can't be trusted to
-- mean "the stage moved." A dedicated, trigger-maintained column is the
-- correct mechanism here, the same reasoning as apply_transaction_delta
-- (migration 0003) for account balances: derive the fact precisely in the
-- database rather than approximate it in application code.
alter table public.deals add column stage_changed_at timestamptz not null default now();

-- Backfill: every existing deal's stage_changed_at becomes its created_at —
-- the honest answer for "when did it last change stage" when no history
-- exists is "we don't know, so treat it as having been in this stage since
-- it was created."
update public.deals set stage_changed_at = created_at;

create or replace function public.track_deal_stage_change()
returns trigger
language plpgsql
as $$
begin
  if old.stage_id is distinct from new.stage_id then
    new.stage_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger trg_deals_track_stage_change
  before update on public.deals
  for each row execute function public.track_deal_stage_change();

create index deals_stage_changed_idx on public.deals (stage_changed_at);
