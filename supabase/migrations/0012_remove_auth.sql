-- Remove authentication entirely. JARVIS is single-user with no concept of
-- "the current user" anywhere in the app anymore — every table becomes a
-- flat, unscoped dataset. This migration is intentionally irreversible in
-- the sense that reconstructing per-user isolation later means re-adding
-- user_id + RLS from scratch (the old policies/columns aren't preserved
-- anywhere but in git history of the earlier migrations).

-- ============================================================================
-- 1. Drop every RLS policy in the public schema (all reference user_id/id,
--    which are going away — no point naming all ~124 individually).
-- ============================================================================
do $$
declare
  r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ============================================================================
-- 2. Disable RLS on every table (harmless to leave enabled with zero
--    policies — everything would just deny-all — but explicit and clean).
-- ============================================================================
do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I disable row level security', r.tablename);
  end loop;
end $$;

-- ============================================================================
-- 3. Drop the 8 cross-table ownership-check triggers + functions. Each one
--    exists only to stop a row's FK (account_id/contact_id/workout_id/...)
--    from pointing at another user's row — meaningless with one dataset, and
--    would error at runtime once user_id disappears (NEW.user_id access).
-- ============================================================================
drop trigger if exists trg_transactions_check_owner on public.transactions;
drop function if exists public.check_transaction_account_owner();

drop trigger if exists trg_workout_sets_check_owner on public.workout_sets;
drop function if exists public.check_workout_set_owner();

drop trigger if exists trg_deals_check_owner on public.deals;
drop function if exists public.check_deal_contact_owner();

drop trigger if exists trg_activities_check_owner on public.activities;
drop function if exists public.check_activity_owner();

drop trigger if exists trg_deal_tasks_check_owner on public.deal_tasks;
drop function if exists public.check_deal_task_owner();

drop trigger if exists trg_contracts_check_owner on public.contracts;
drop function if exists public.check_contract_contact_owner();

drop trigger if exists trg_onboarding_tasks_check_owner on public.client_onboarding_tasks;
drop function if exists public.check_onboarding_task_owner();

-- ============================================================================
-- 4. Drop user_id from every table. CASCADE takes the now-orphaned
--    composite unique constraints/indexes with it (e.g. budgets_user_id_
--    category_key, workouts_user_external_id_key) — no need to name them.
-- ============================================================================
alter table public.tasks drop column user_id cascade;
alter table public.goals drop column user_id cascade;
alter table public.habits drop column user_id cascade;
alter table public.habit_logs drop column user_id cascade;
alter table public.journal_entries drop column user_id cascade;
alter table public.prayers drop column user_id cascade;
alter table public.prayer_logs drop column user_id cascade;

alter table public.accounts drop column user_id cascade;
alter table public.transactions drop column user_id cascade;
alter table public.budgets drop column user_id cascade;
alter table public.trades drop column user_id cascade;

alter table public.exercises drop column user_id cascade;
alter table public.workouts drop column user_id cascade;
alter table public.workout_sets drop column user_id cascade;
alter table public.nutrition_targets drop column user_id cascade;
alter table public.nutrition_logs drop column user_id cascade;
alter table public.water_logs drop column user_id cascade;
alter table public.mentor_messages drop column user_id cascade;

alter table public.market_analyses drop column user_id cascade;
alter table public.trade_checklist_items drop column user_id cascade;

alter table public.pipeline_stages drop column user_id cascade;
alter table public.contacts drop column user_id cascade;
alter table public.deals drop column user_id cascade;
alter table public.activities drop column user_id cascade;
alter table public.deal_tasks drop column user_id cascade;
alter table public.contracts drop column user_id cascade;
alter table public.client_onboarding_tasks drop column user_id cascade;
alter table public.ghl_connections drop column user_id cascade;
alter table public.ghl_sync_logs drop column user_id cascade;

alter table public.daily_recommendations drop column user_id cascade;
alter table public.weekly_reviews drop column user_id cascade;

-- ============================================================================
-- 5. Re-add corrected constraints/indexes on the natural remaining key
--    (the two true one-row tables, nutrition_targets/ghl_connections, get no
--    replacement constraint — app code now fetches the single row by id).
-- ============================================================================
alter table public.budgets add constraint budgets_category_key unique (category);
alter table public.market_analyses add constraint market_analyses_pair_date_key unique (pair, analysis_date);
alter table public.contacts add constraint contacts_external_id_key unique (external_id);
alter table public.deals add constraint deals_external_id_key unique (external_id);
alter table public.workouts add constraint workouts_external_id_key unique (external_id);
alter table public.exercises add constraint exercises_external_id_key unique (external_id);
alter table public.daily_recommendations add constraint daily_recommendations_rec_date_key unique (rec_date);
alter table public.weekly_reviews add constraint weekly_reviews_week_start_date_key unique (week_start_date);

create index transactions_occurred_idx on public.transactions (occurred_at desc);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_category_idx on public.transactions (category);
create index trades_opened_idx on public.trades (opened_at desc);
create index trades_status_idx on public.trades (status);
create index tasks_due_idx on public.tasks (due_date);
create index goals_timeframe_idx on public.goals (timeframe);
create index habit_logs_date_idx on public.habit_logs (log_date);
create index journal_entries_date_idx on public.journal_entries (entry_date desc);
create index prayer_logs_date_idx on public.prayer_logs (log_date);
create index workouts_started_idx on public.workouts (started_at desc);
create index workout_sets_workout_idx on public.workout_sets (workout_id);
create index nutrition_logs_date_idx on public.nutrition_logs (logged_at desc);
create index water_logs_date_idx on public.water_logs (log_date);
create index mentor_messages_context_idx on public.mentor_messages (context, created_at);
create index deals_stage_idx on public.deals (stage_id);
create index activities_contact_idx on public.activities (contact_id, occurred_at desc);
create index deal_tasks_deal_idx on public.deal_tasks (deal_id);
create index contracts_status_idx on public.contracts (status);
create index onboarding_tasks_contact_idx on public.client_onboarding_tasks (contact_id);
create index ghl_sync_logs_created_idx on public.ghl_sync_logs (created_at desc);
create index market_analyses_date_idx on public.market_analyses (analysis_date desc);
create index daily_recommendations_date_idx on public.daily_recommendations (rec_date desc);
create index weekly_reviews_week_idx on public.weekly_reviews (week_start_date desc);

-- ============================================================================
-- 6. Drop profiles entirely — nothing to sync from auth.users once nothing
--    ever authenticates. The auth.users row for the old fixed account is
--    left alone (harmless, unused) since deleting it isn't necessary and
--    Supabase Auth as a project feature isn't something this migration
--    manages either way.
-- ============================================================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.profiles;
