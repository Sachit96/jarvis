-- Defense in depth: the transactions RLS insert/update policy only checks
-- auth.uid() = user_id, not that account_id actually belongs to that user. A
-- client hitting PostgREST directly (bypassing the app's Server Action check)
-- could otherwise write a transaction against another user's account and, via
-- the balance-sync trigger, corrupt that account's balance. Enforce ownership
-- at the DB level so this can't happen regardless of the calling code path.
create or replace function public.check_transaction_account_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
begin
  select user_id into owner from public.accounts where id = NEW.account_id;
  if owner is null or owner <> NEW.user_id then
    raise exception 'account % does not belong to this user', NEW.account_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_transactions_check_owner
  before insert or update on public.transactions
  for each row execute function public.check_transaction_account_owner();
