-- SMS logging engine (Work Order 5) — every inbound message gets a row
-- regardless of outcome, both as an audit log (matching this app's
-- established convention — ghl_sync_logs, scheduled_runs, research_runs)
-- and as the backing store for the hourly rate guard (count rows from the
-- last hour rather than an in-memory counter, which wouldn't survive
-- serverless cold starts or multiple instances).
create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  from_number text not null,
  body text not null,
  -- Which tool the parser matched (log_workout/log_nutrition/complete_task/
  -- log_study_session/add_journal_entry), or null if the request was
  -- rejected before parsing (bad signature, not the allowlisted number,
  -- rate-limited).
  action_taken text,
  reply text not null,
  status text not null default 'processed' check (status in ('processed', 'rejected_signature', 'rejected_sender', 'rate_limited', 'error')),
  created_at timestamptz not null default now()
);
create index sms_messages_from_created_idx on public.sms_messages (from_number, created_at desc);

-- Same divergence from the pre-0012 schema as every table since — RLS
-- enabled with zero policies, deny-all to the anon key.
alter table public.sms_messages enable row level security;
