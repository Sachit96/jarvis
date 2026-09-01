-- Flashcards (Work Order 3) — generated from a uni_materials entry,
-- reviewed with a simple spaced-repetition interval (doubling on correct,
-- reset to 1 day on incorrect) rather than full SM-2, per the work order's
-- explicit scope line.
create table public.uni_flashcards (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.uni_materials(id) on delete cascade,
  question text not null,
  answer text not null,
  last_reviewed timestamptz,
  -- Interval in days until the next review is due — doubles on a correct
  -- answer (capped), resets to 1 on an incorrect one. Named "ease" per the
  -- work order's own column list, though it's really the current interval,
  -- not a per-card multiplier the way real SM-2's ease factor works.
  ease numeric(6,1) not null default 1,
  next_review timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.uni_flashcards
  for each row execute function extensions.moddatetime(updated_at);
create index uni_flashcards_material_idx on public.uni_flashcards (material_id);
create index uni_flashcards_next_review_idx on public.uni_flashcards (next_review);

-- Same divergence from the pre-0012 schema as every uni_* table before it
-- — RLS enabled with zero policies, deny-all to the anon key.
alter table public.uni_flashcards enable row level security;
