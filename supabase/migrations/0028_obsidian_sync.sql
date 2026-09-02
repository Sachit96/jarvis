-- Obsidian integration (Session 2, Phase 3). Two tables:
--
-- note_links — the wikilink graph. [[Title]] references parsed out of
-- memory_entries/journal_entries body text, resolved against titles
-- across every linkable domain (memory entries, contacts, uni courses,
-- deals, journal entries), so backlinks can be shown on any of them
-- regardless of which domain the reference lives in.
create table public.note_links (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('memory_entry', 'contact', 'uni_course', 'deal', 'journal_entry')),
  source_id uuid not null,
  target_type text not null check (target_type in ('memory_entry', 'contact', 'uni_course', 'deal', 'journal_entry')),
  target_id uuid not null,
  -- The literal text inside [[...]] at parse time, kept verbatim even
  -- though target_id already resolves it — useful for debugging a bad
  -- resolution without re-parsing the source body.
  link_text text not null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, target_type, target_id)
);
create index note_links_source_idx on public.note_links (source_type, source_id);
create index note_links_target_idx on public.note_links (target_type, target_id);
alter table public.note_links enable row level security;

-- obsidian_sync_state — one row per memory_entries row that has ever been
-- synced to a vault file, tracking exactly enough to detect a genuine
-- conflict (both sides changed since the last successful sync) rather
-- than a one-sided change (only apply that side). Lives entirely outside
-- memory_entries itself so the sync mechanism's bookkeeping doesn't leak
-- into a table the rest of the app already reads/writes independently of
-- Obsidian ever being involved.
create table public.obsidian_sync_state (
  memory_entry_id uuid primary key references public.memory_entries(id) on delete cascade,
  vault_relative_path text not null,
  -- SHA-256 of the exact file content (frontmatter + body) as of the last
  -- successful sync — compared against the vault file's CURRENT hash to
  -- detect a local-side change; the DB side's change is detected by
  -- comparing memory_entries.updated_at against last_synced_at instead.
  last_synced_content_hash text not null,
  last_synced_at timestamptz not null default now()
);

-- Same divergence from the pre-0012 schema as every table since — RLS
-- enabled with zero policies, deny-all to the anon key.
alter table public.obsidian_sync_state enable row level security;
