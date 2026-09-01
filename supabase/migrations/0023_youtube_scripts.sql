-- YouTube research/script/thumbnail pipeline (Work Order 4). Same
-- unscoped, RLS-enabled-zero-policies posture as every table since 0012.
create table public.yt_scripts (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  niche text,
  research_summary text,
  hook text,
  script_body text,
  sections jsonb not null default '[]'::jsonb,
  estimated_runtime_sec int,
  suggested_titles text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'approved', 'used')),
  -- True only if the research step's Gemini response actually came back
  -- with real grounding citations (groundingMetadata) — see
  -- lib/ai/providers/gemini-youtube.ts. Surfaced so the UI never claims a
  -- web search happened when the model may have just reasoned from its
  -- own training data instead.
  research_grounded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.yt_scripts
  for each row execute function extensions.moddatetime(updated_at);
create index yt_scripts_status_idx on public.yt_scripts (status, created_at desc);
alter table public.yt_scripts enable row level security;

create table public.yt_thumbnails (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.yt_scripts(id) on delete cascade,
  prompt text not null,
  -- Base64 image data stored inline, not a storage bucket URL — no
  -- Supabase Storage bucket was set up for this tonight, and a handful of
  -- thumbnail-sized images per script is small enough not to need one yet.
  image_base64 text,
  mime_type text not null default 'image/png',
  selected boolean not null default false,
  created_at timestamptz not null default now()
);
create index yt_thumbnails_script_idx on public.yt_thumbnails (script_id);
alter table public.yt_thumbnails enable row level security;
