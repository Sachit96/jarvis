-- Phase 0: profiles table synced from auth.users, plus the shared
-- moddatetime trigger every later migration's tables will reuse.

create extension if not exists moddatetime schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "select_own_profile" on public.profiles
  for select using (auth.uid() = id);
create policy "update_own_profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create trigger set_updated_at
  before update on public.profiles
  for each row execute procedure extensions.moddatetime(updated_at);

-- Sync new auth.users rows into public.profiles automatically.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
