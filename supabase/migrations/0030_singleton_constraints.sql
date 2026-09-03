-- Hygiene fix alongside the Business Pipeline Cockpit milestone.
--
-- nutrition_targets and ghl_connections both lost their `unique (user_id)`
-- constraint when 0012_remove_auth dropped user_id — app code has assumed
-- "exactly one row" by convention ever since, with nothing in the database
-- actually enforcing it. A duplicate row in either table would make
-- .maybeSingle() reads silently pick whichever one Postgres happens to
-- return first, which is a real, if quiet, correctness risk.
--
-- This is the same "exactly one row" requirement anthropic_settings
-- (0025) and yt_connections (0026) enforce via `id boolean primary key
-- default true check (id)` — but that trick only works when the table is
-- created fresh. These two tables already exist with their own uuid
-- primary keys and, potentially, real data, so the fix here is a unique
-- index on a constant expression instead: since every row evaluates the
-- expression to the same value, Postgres's uniqueness check has nothing
-- left to distinguish rows by, and a second insert fails outright.
--
-- BEFORE RUNNING: if either table already holds more than one row, this
-- migration fails with a uniqueness violation rather than silently
-- deleting/merging anything — check first and manually resolve down to one
-- row:
--   select count(*) from public.nutrition_targets;
--   select count(*) from public.ghl_connections;

create unique index if not exists nutrition_targets_singleton_idx on public.nutrition_targets ((true));
create unique index if not exists ghl_connections_singleton_idx on public.ghl_connections ((true));
