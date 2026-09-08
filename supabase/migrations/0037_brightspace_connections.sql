-- Brightspace (D2L Valence) OAuth2 connection storage.
--
-- Same "true one-row table" shape as yt_connections/anthropic_settings:
-- a single institution account, so reconnecting overwrites this row rather
-- than accumulating history.
--
-- Tokens in plain text, matching this schema's existing precedent
-- (yt_connections.refresh_token, ghl_connections.private_token). There is
-- no encryption-at-rest layer here to be consistent with, and the
-- service-role key already gates the whole table from anyone but this
-- app's own server code. NO PASSWORD IS EVER STORED — the Valence flow is
-- authorization-code only, and nothing in the adapter accepts one.
create table public.brightspace_connections (
  id boolean primary key default true check (id),
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  scope text not null,
  -- The institution host this token is valid for. Stored rather than read
  -- from env at use time so a changed BRIGHTSPACE_HOST cannot silently
  -- point an existing token at a different institution.
  host text not null,
  -- Cosmetic, for the Settings card. Null when the whoami lookup fails —
  -- which must never fail the connection itself.
  display_name text,
  connected_at timestamptz not null default now(),
  -- Null until the first sync runs; distinguishes "connected but never
  -- synced" from "synced a while ago", which are different problems.
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.brightspace_connections
  for each row execute function extensions.moddatetime(updated_at);

-- Same as every table since 0012: RLS on with zero policies, deny-all to
-- the anon key. Only the service-role client reaches this.
alter table public.brightspace_connections enable row level security;
