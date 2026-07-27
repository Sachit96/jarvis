-- Fix: PostgREST's .upsert({ onConflict }) generates a plain
-- `ON CONFLICT (col1, col2)` clause with no WHERE predicate, which Postgres
-- cannot match against a partial unique index — every GHL contact/deal
-- upsert was failing with 42P10 ("no unique or exclusion constraint
-- matching the ON CONFLICT specification"). Postgres already treats NULL as
-- distinct from NULL in uniqueness checks, so a plain unique constraint
-- allows unlimited external_id = NULL rows without needing a partial index.
drop index if exists public.contacts_user_external_id_idx;
alter table public.contacts add constraint contacts_user_external_id_key unique (user_id, external_id);

drop index if exists public.deals_user_external_id_idx;
alter table public.deals add constraint deals_user_external_id_key unique (user_id, external_id);
