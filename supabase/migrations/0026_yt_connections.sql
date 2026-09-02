-- YouTube upload path (Work Order 7) — OAuth2 connection storage. Single
-- Google account, single row, same "true one-row table" pattern as
-- anthropic_settings/nutrition_targets/ghl_connections — reconnecting
-- (a fresh OAuth round trip) just overwrites this one row rather than
-- accumulating history.
--
-- Tokens stored in plain text, matching this app's existing precedent
-- (ghl_connections.private_token is also plain text) — there's no
-- encryption-at-rest layer anywhere in this schema to be consistent
-- with, and the service-role key already gates the whole table from
-- anyone but this app's own server code.
create table public.yt_connections (
  id boolean primary key default true check (id),
  access_token text not null,
  refresh_token text not null,
  -- While the OAuth consent screen is in "Testing" publishing status
  -- (not yet verified/published), Google expires refresh tokens after 7
  -- days regardless of use — see lib/youtube/oauth.ts's doc comment.
  -- connected_at is what the Settings card uses to compute connection
  -- age and warn before that silent expiry actually bites.
  token_expires_at timestamptz not null,
  scope text not null,
  channel_id text,
  channel_title text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.yt_connections
  for each row execute function extensions.moddatetime(updated_at);

-- Same divergence from the pre-0012 schema as every table since — RLS
-- enabled with zero policies, deny-all to the anon key.
alter table public.yt_connections enable row level security;

-- Which real YouTube video a script became, once uploaded — needed so
-- approveToPublishAction knows which video to call videos.update on.
-- Null until uploadVideoToYouTubeAction succeeds.
alter table public.yt_scripts add column youtube_video_id text;

-- Local cache of the video's real privacyStatus, set right after each
-- successful upload/publish call (not re-checked via videos.list on
-- every page load, to avoid spending quota on that) — 'private'
-- immediately after upload, 'public' only after approveToPublishAction.
-- Could drift from the real value if privacy is changed directly on
-- YouTube itself; acceptable for a single-user personal tool.
alter table public.yt_scripts add column youtube_privacy_status text check (youtube_privacy_status in ('private', 'public'));
