# JARVIS — Obsidian as the note layer across every domain

## The constraint that shapes everything

Obsidian vaults are local markdown files. JARVIS is deployed on Netlify and cannot read the user's filesystem. Therefore:

- **Supabase remains the source of truth.** The deployed app reads from the DB, exactly as it does today.
- **The vault is a bidirectionally-synced mirror**, maintained by a local script the user runs on their Mac.
- Obsidian is the *writing* surface. JARVIS is the *reading, reasoning, and mobile* surface.

Do not attempt to have the deployed app read the vault directly. Do not propose Obsidian Sync, iCloud, or Dropbox as a bridge — Netlify can't reach any of them either.

## Vault structure

The vault lives at `Jarvis memory/` in the repo root (it already exists there, currently disconnected). Restructure into domain folders, each mapping to a real table:

```
Jarvis memory/
  memory/      → memory_entries
  journal/     → journal_entries
  courses/     → uni_materials  (subfolder per course code)
  clients/     → contacts (notes field) + activities
  deals/       → deals (notes field)
  trading/     → market_analyses
  youtube/     → yt_scripts
  daily/       → daily_recommendations (the AI briefs, read-only from vault side)
```

Every note carries frontmatter that makes the mapping unambiguous:

```yaml
---
jarvis_id: <uuid>          # DB primary key; absent means "new, not yet in DB"
jarvis_table: memory_entries
type: fact                 # domain-specific, matches the table's own enum
tags: [agency, pricing]
pinned: false
updated: 2026-09-01T14:32:00Z
---
```

`gray-matter` is already a dependency — use it, don't add a parser.

## The sync script

`scripts/obsidian-sync.mjs`, run via `npm run sync:obsidian`.

**Bidirectional, last-write-wins, per-note:**

1. Read every `.md` in the vault, parse frontmatter.
2. Fetch corresponding rows from every mapped table.
3. For each note with a `jarvis_id`: compare vault `updated` against DB `updated_at`. Newer wins. Write the loser's version to `Jarvis memory/.conflicts/` with a timestamp rather than discarding it — never destroy data silently.
4. For each note **without** a `jarvis_id`: insert into the mapped table, then write the returned UUID back into the note's frontmatter.
5. For each DB row with **no corresponding note**: create the markdown file.
6. For a note deleted from the vault: **do not delete the DB row.** Report it and let the user decide. Deletion asymmetry is deliberate — an accidental file deletion should never nuke a database record.

**Output a summary every run:** created, updated, conflicted, skipped. If anything conflicted, say so loudly.

**Dry-run flag required:** `npm run sync:obsidian -- --dry-run` prints what would change without touching anything. Default to suggesting this before a first real run.

## Wikilinks and backlinks

This is the part that makes it feel like Obsidian rather than a folder of text files.

- Parse `[[note-name]]` in any synced body text.
- Store resolved links in a new `note_links` table: `source_table`, `source_id`, `target_table`, `target_id`, `raw_link`.
- Render wikilinks in JARVIS as real navigation links to the target record's page.
- Show a **Backlinks** section on every record that has inbound links — memory entries, contacts, courses, deals, journal entries. This is the feature that turns separate domains into one connected brain.
- Unresolved links (pointing at a note that doesn't exist yet) render as dim/italic, same convention Obsidian uses. Don't error on them.

## Cross-domain integration — the actual ask

"Not just AI mentor" means every domain gets note affordances:

- **Courses** (`/uni/courses/[id]`): lecture notes, readings, and materials are vault files. Writing a note in `courses/QMS210/` appears in the course page after sync.
- **Clients & deals**: a "Notes" tab reading the synced body, with backlinks showing every other note that references that client.
- **Journal**: `journal/2026-09-01.md` ↔ `journal_entries`. Obsidian daily notes work natively.
- **Trading**: `trading/` notes link to specific trades via `[[trade-2026-09-01-EURUSD]]`.
- **Memory**: as today, but now editable in Obsidian.
- **⌘K search**: extend the existing command palette to search across all synced note bodies, not just titles.

## AI context

`lib/ai/persona.ts` currently injects up to 10 pinned/fact/preference memory entries. Extend it:

- When a mentor question mentions an entity that has notes (a course, a client, a deal), pull that note's body into context.
- Cap hard at ~4000 characters of note context per call — the Gemma tier's 16K TPM ceiling is real and hidden thinking tokens already eat into it.
- Prefer pinned notes and recently-updated notes when selecting.

## Automating the sync

Give the user a `launchd` plist (macOS's cron equivalent) that runs the sync every 15 minutes while their Mac is awake, plus instructions to install it. Make it optional — manual `npm run sync:obsidian` must work standalone.

Also add a **"Last synced"** timestamp somewhere visible in JARVIS Settings, reading from a `sync_runs` table, so stale data is obvious rather than mysterious.

## What NOT to build

- No attempt at real-time sync. 15-minute polling is fine.
- No vector embeddings or semantic search over the vault — volume doesn't justify it and it'd blow the token budget.
- No Obsidian plugin. The sync script is enough.
- Don't touch the existing `memory_entries` UI — Obsidian is an *additional* editing surface, not a replacement for the web UI.

## Verification

- Create a note in Obsidian, run sync, confirm it appears in JARVIS with a UUID written back into the file.
- Edit the same record in the JARVIS web UI, run sync, confirm the vault file updates.
- Edit both sides between syncs, confirm the conflict lands in `.conflicts/` and is reported.
- Create `[[wikilinks]]` between a client note and a memory entry, confirm backlinks render on both.
- Delete a vault file, run sync, confirm the DB row survives and the deletion is reported not executed.
- Run `--dry-run` first on a vault with real changes and confirm it touches nothing.
