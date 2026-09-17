-- Google Calendar two-way sync — connection storage and the local<->Google
-- event mapping that makes re-syncing update existing events instead of
-- duplicating them every run.
--
-- A SEPARATE OAuth client from YouTube's (GOOGLE_CALENDAR_CLIENT_ID/SECRET,
-- not YOUTUBE_CLIENT_ID/SECRET) — the user was asked directly whether to
-- reuse the YouTube client or set up a new one, and chose a new one, so
-- the two integrations stay fully independent in Google Cloud Console.
--
-- Same "true one-row table" singleton pattern as yt_connections
-- (migration 0026): one Google account connected at a time, reconnecting
-- overwrites the row. Tokens stored in plain text, matching this app's
-- existing precedent (yt_connections.access_token, ghl_connections'
-- former private_token) — there is no encryption-at-rest layer anywhere
-- in this schema to be consistent with, and the service-role key already
-- gates the whole table from anyone but this app's own server code.

create table public.google_calendar_connections (
  id boolean primary key default true check (id),
  access_token text not null,
  refresh_token text not null,
  -- Same Testing-mode 7-day refresh token expiry as YouTube's OAuth client
  -- while the Google Cloud consent screen is unpublished — see
  -- lib/google-calendar/constants.ts.
  token_expires_at timestamptz not null,
  scope text not null,
  -- The dedicated calendar JARVIS creates on first connect (see
  -- lib/google-calendar/client.ts's findOrCreateJarvisCalendar), not the
  -- user's primary calendar — keeps synced blocks out of a calendar they
  -- already use for everything else, and means a bad sync can be undone by
  -- deleting one calendar rather than hunting individual events.
  calendar_id text not null,
  calendar_summary text not null,
  -- Google's sync token for incremental pull (events.list?syncToken=...).
  -- Null until the first successful pull; a 410 response from Google means
  -- the token expired and the next pull must fall back to a full list.
  sync_token text,
  last_synced_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.google_calendar_connections
  for each row execute function extensions.moddatetime(updated_at);

alter table public.google_calendar_connections enable row level security;

-- Which Google Calendar event a local row became, so re-running the sync
-- updates that event instead of creating a duplicate, and so a pulled
-- change on an event JARVIS created can be traced back to its source row.
-- One row per (source_type, source_id): a class block, a personal routine
-- block, a deadline or an assessment due date maps to at most one event.
create table public.google_calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (
    source_type in ('life_schedule_block', 'uni_schedule_block', 'uni_deadline', 'uni_assessment')
  ),
  source_id uuid not null,
  google_event_id text not null,
  last_pushed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_type, source_id),
  unique (google_event_id)
);
alter table public.google_calendar_event_links enable row level security;
