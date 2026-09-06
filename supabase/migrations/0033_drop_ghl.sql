-- GoHighLevel integration discontinued entirely (not hardened, removed).
-- No UI, action, route, or query references ghl_connections or
-- ghl_sync_logs anymore as of this migration — grepped the whole codebase
-- case-insensitively for "ghl"/"gohighlevel" before writing this.
--
-- ghl_connections_singleton_idx (added in 0030_singleton_constraints.sql,
-- two sessions ago) is dropped automatically along with the table — that's
-- expected, not an error, and needs no separate `drop index`.
--
-- contacts.source and deals.source keep whatever historical 'ghl' values
-- already exist — those are just a plain enum-ish text column on tables
-- that aren't going anywhere, not GHL infrastructure, so old synced rows
-- stay as an honest historical record rather than being rewritten or
-- deleted.
--
-- Written but NOT applied, same as 0029_drop_prayers.sql / 0031_drop_yt_thumbnails.sql
-- — your call, not run automatically.
drop table if exists public.ghl_sync_logs;
drop table if exists public.ghl_connections;
