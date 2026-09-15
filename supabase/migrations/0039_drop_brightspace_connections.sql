-- Brightspace integration discontinued entirely (not hardened, removed).
-- No UI, action, route, or query references brightspace_connections
-- anymore as of this migration — grepped the whole codebase
-- case-insensitively for "brightspace" before writing this; the only
-- surviving mentions are env-var name strings in security/redaction
-- tests, unrelated to this table.
--
-- Written but NOT applied, same as 0029_drop_prayers.sql / 0033_drop_ghl.sql
-- — your call, not run automatically.
drop table if exists public.brightspace_connections;
