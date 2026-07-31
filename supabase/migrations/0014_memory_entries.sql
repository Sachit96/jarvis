-- Typed memory store backing the redesigned /memory module. Replaces the
-- read-only Obsidian-vault view (lib/obsidian.ts) as the primary surface for
-- Memory — the vault files on disk are left untouched and are backfilled
-- into this table by a one-off script (scripts/_backfill-memory.mjs), not by
-- this migration, since SQL can't read the filesystem.
create table public.memory_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('fact', 'preference', 'person', 'project', 'protocol', 'reference')),
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  source text not null default 'manual' check (source in ('manual', 'captured')),
  pinned boolean not null default false,
  confidence int check (confidence between 0 and 100),
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memory_entries_type_idx on public.memory_entries (type);
create index memory_entries_updated_idx on public.memory_entries (updated_at desc);

create trigger set_updated_at before update on public.memory_entries
  for each row execute procedure extensions.moddatetime(updated_at);
