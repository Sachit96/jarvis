# JARVIS — Overnight Session 2: verify, harden, then build Obsidian

I'm asleep. Work continuously and unattended. Every decision below is pre-approved — **do not stop to ask me anything.** Where you'd normally check in, take the RECOMMENDED option and note it in the morning report.

Same operating rules as last night, restated because they matter:

1. **Never leave the app broken.** After each phase: typecheck, lint, and a full route sweep. If something breaks and you can't fix it in 15 minutes, revert that phase and move on.
2. **Commit after every phase.** Push. Don't leave work sitting locally — unpushed commits were one of last night's two bugs.
3. **You cannot apply migrations.** Write them as numbered files, hand-patch `database.types.ts`, and put the consolidated list at the top of the morning report. Every code path touching a new table must degrade gracefully when it doesn't exist yet.
4. **Never write to `.env.local`.** That file is mine. Read from `process.env` only. If you believe it needs changing, tell me in the report instead of doing it.
5. **Free-tier budget discipline.** Gemma tier for plain text and tool calls, Flash-Lite only where nested/enum `responseSchema` reliability is genuinely required. Every new call site increments `gemini_usage`.

---

# PHASE 1 — Answer the open questions and verify everything (do first)

## 1a. The `.env.local` corruption

Your last report mentioned fixing "`.env.local` corruption" as one of two bugs. Tell me plainly: what corrupted, when, what caused it, and did you write to that file? I don't expect you to be editing my credentials. If you did, say so directly — I'd rather know than have it recur silently.

## 1b. Full end-to-end verification

Everything is now real: all migrations through 0026 applied, every env var set locally and mirrored to Netlify, YouTube OAuth credentials in place, site redeployed. Verify against real data, live in the browser, not by reasoning:

- **`/uni`** — loads, grade engine returns correct numbers. Seed one real course with a few graded and ungraded assessments and confirm: current grade, semester average, needed-on-remaining, best/worst case, and risk score are all arithmetically correct. This is pure-function code — if it's wrong, everything built on it is wrong.
- **`/youtube`** — generate one real script. Confirm the "web-grounded" vs "AI-reasoned" label actually reflects whether citations came back, rather than being cosmetic.
- **`/voice`** — loads, per-model usage row shows real numbers from `gemini_usage`.
- **SMS read paths** — work against the now-existing `sms_messages` table.
- **All 20+ existing routes** — still 200, no console errors.

## 1c. The Anthropic spend cap — highest priority item in this phase

This is my only paid API and the cap has never fired against a real call. Run **one** real lead qualification through Anthropic and report:

- The actual dollar amount recorded in `anthropic_usage`
- Whether it matches the token counts the API returned × the per-MTok rates in your constants
- That `isAnthropicAvailable()` correctly returns false when spend would exceed the $3 cap (test this by temporarily lowering the cap in code, not by spending $3)
- That the fallback to Gemini works when it returns false

If the metering is wrong in either direction, stop and fix it before anything else in this document. An undercounting spend cap on a pay-per-token API is the single most expensive bug available in this codebase.

## 1d. Thumbnails

Imagen-with-free-quota turned out not to exist on my key. Tell me what image generation actually costs now, or whether it's off the table on free tier entirely. If it's off the table, remove or clearly disable the thumbnail UI rather than leaving a button that always errors.

---

# PHASE 2 — Security hardening

The audit flagged several things. Do these:

- **`/api/export/json` has no auth of its own.** It dumps ~30 tables including finances and health data, protected only by the outer site password. Add `CRON_SECRET`-style bearer auth or a separate export token. RECOMMENDED: require the same bearer token as `/api/mentor/run`.
- **`/api/hevy` has no auth at all.** Same treatment.
- **`/api/research/runs*` has no auth** and fires real metered Google API calls. Same treatment.
- **Rate limiting.** There is none anywhere except the Gemini daily counter. Add a simple in-memory or DB-backed limiter to every API route that costs money or does real work: research runs, exports, Hevy sync, SMS webhook (already has one — keep it).
- **GHL webhook** still uses a shared-secret query param rather than a verified signature. Research GoHighLevel's actual webhook signing scheme. If you can confirm it, implement it. If you can't confirm it from primary documentation, leave the stopgap and say so — do not guess at a signature format.

---

# PHASE 3 — Obsidian integration

Full spec is in `jarvis-obsidian-integration-spec.md`, already in your context. Build it.

The constraint that shapes everything: **Obsidian vaults are local files; JARVIS is deployed on Netlify and cannot read my filesystem.** Supabase stays the source of truth. The vault is a bidirectionally-synced mirror maintained by a local script I run on my Mac. Do not attempt to have the deployed app read the vault directly, and do not propose Obsidian Sync, iCloud, or Dropbox as a bridge — Netlify can't reach any of them.

Key requirements from that spec, restated because they're the ones easiest to get wrong:

- **Deletion asymmetry.** A note deleted from the vault must NOT delete the DB row. Report it, let me decide.
- **Conflicts go to `.conflicts/`**, never silently discarded.
- **`--dry-run` flag required** and must be genuinely safe.
- **Wikilinks and backlinks** across domains — this is the feature that makes it feel like one brain rather than a folder of text. `note_links` table, backlinks section on memory entries, contacts, courses, deals, journal entries.
- **AI context injection capped at ~4000 characters** of note content per call. The Gemma 16K TPM ceiling is real and hidden thinking tokens already eat into it.
- Reuse `gray-matter` — already a dependency.

---

# PHASE 4 — Cleanup (only if 1–3 are genuinely complete)

- **Orphaned schema:** `prayers` / `prayer_logs` tables and `prayerSchema` in `lib/validations/life.ts` have no UI or actions. Remove the Zod schema; write a migration dropping the tables but DO NOT include it in the run-these list — flag it separately so I can decide.
- **`lib/supabase/server.ts` and `admin.ts`** are near-duplicates. Consolidate.
- **Three `<ComingSoon>` stubs** (`/finance/assets`, `/finance/goals`, `/health/settings`) — remove them from navigation rather than leaving dead links. Don't build them.
- **Responsive coverage.** Only ~21% of files use any breakpoint, concentrated in the nav shell. The domain component libraries (`health/`, `life/`, `mentor/`, `dashboard/`, `settings/`) have zero. Do a pass on `dashboard/` specifically — it's the home page and the most-used surface.
- **Error boundaries.** No `error.tsx` handling was confirmed anywhere. Add route-level error boundaries so a failed server-component fetch shows something useful rather than a raw stack trace.

---

# MORNING REPORT

1. **The migration list** — every file I need to run, in order, one line each. Top of the report.
2. **The Anthropic spend number** from Phase 1c, and whether the cap fires correctly.
3. The `.env.local` corruption answer.
4. What's verified working vs. what you couldn't test and why.
5. Every ambiguous call you made.
6. Anything that concerns you — bad assumptions in this spec, existing behaviour you found broken, anything that fought you. Be blunt.
7. Anything you had to guess at without being able to verify live.
