# On Radar → JARVIS Lead Research merge plan

Deferred until after Sep 9 (sprint ends then; this doesn't close deals before it).
Written up now so the comparison and decision survive until then.

## Background

`~/Lead Generation` ("On Radar · Lead Engine") is a separate, standalone Next.js +
SQLite app, not part of JARVIS, built and iterated on across several sessions
(198 real businesses processed, 86 owner candidates, evidence of real debugging
passes — "misattribution fix," "niche-city backfill" — in its own data
directory). It is not a spec or a draft; it's working code.

JARVIS's existing Lead Research pipeline (`lib/research/*`, `actions/lead-research-actions.ts`,
`lead_research` table from `supabase/migrations/0015_lead_research.sql`) stays
exactly as it is through this whole deferral — it was extensively debugged over
several sessions and currently works. Nothing here touches it until this plan is
picked back up.

## Why merge, not replace

The two systems solve adjacent, not identical, problems:

- **JARVIS's pipeline** answers "who has a bad website I can pitch digital
  services to" — Google Places discovery → website audit + PageSpeed → LLM
  opportunity scoring (`new_website`, `seo`, `ai_chatbot`, ...).
- **On Radar** answers "who's a real independent owner with a validated phone
  number I can call" — Outscraper discovery → phone validation → dedup →
  owner identification → independence classification → a Call View built for
  working the list live.

**Decision (2026-09-06): cold calling is the primary channel** (07:00–08:30 and
17:00–18:30 blocks), so On Radar's owner-ID + phone-validation motion is the
one that matters most here. JARVIS's web-audit/opportunity scoring is
secondary — real, worth keeping, but not what closes calls. This is why the
plan below front-loads the calling-motion pieces and leaves the website-audit
side untouched throughout.

Replacing the existing pipeline outright would mean porting SQLite → Supabase,
swapping Places for Outscraper (a new API cost), and rebuilding a Call View —
while **losing** the website-audit/opportunity-scoring capability unless it's
rebuilt on top of the replacement. The additive path below keeps everything
that already works and layers the calling-motion capabilities on top of it as
new columns and new enrichment steps, not a rewrite.

## Order (cheapest / highest-confidence first, the real prize last)

### 1. Phone validation

Port `lib/phone/validate.ts` from On Radar (libphonenumber-js, already a
JARVIS-compatible dependency — no framework coupling in that file). Add a
`phone_valid` / `phone_e164` pair of columns to `lead_research` (mirroring
On Radar's `BusinessRow.phone_valid` / `phone_e164` / `phone_reject_reason`
shape in `lib/db/types.ts`). Run it once over existing rows as a backfill,
then wire it into the existing research job so every new row gets validated
on insert. Pure function, isolated, no other system depends on it yet —
lowest-risk first step.

### 2. Multi-tier dedup

Moved earlier in this pass (originally last in the capability list, but it's
cheap and a strict upgrade over what's there). JARVIS currently dedupes on
`google_place_id` alone (`lead_research.google_place_id unique`). On Radar's
`lib/dedup/dedup.ts` + `lib/dedup/nameSimilarity.ts` implement a tiered
fallback — place_id → cid → phone → domain → fuzzy name+proximity — with a
merge audit trail. Port the tiering logic; the audit-trail table can be
skipped for v1 unless it turns out to matter once this runs against real
JARVIS data — note that call, don't build it speculatively.

### 3. Independence classification

Port `lib/scoring/classify.ts` + its two static data files
(`lib/scoring/franchiseList.ts`, `lib/scoring/areaCodes.ts` — the latter is
explicitly a small seed list of major Canadian metros in On Radar, not a full
database; keep that limitation, don't silently expand it into a guess).
Franchise-list/keyword matches and same-name multi-address detection
short-circuit straight to a classification (franchise/chain) rather than
entering the weighted score — that's deterministic evidence, not a fuzzy
signal, and On Radar's own comment is explicit that classification is a
filterable label, never a delete/hide gate. Add `business_type` and
`independent_confidence` columns to `lead_research`, matching On Radar's
`BusinessRow` shape.

### 4. Owner identification + the hallucination-verification gate

The real prize, and the biggest lift — it needs a review-data source JARVIS
doesn't currently fetch. JARVIS's Google Places discovery pulls place
metadata only; On Radar's owner-ID pipeline (`lib/enrichment/ownerFromReviews.ts`,
`lib/enrichment/ownerFromWebsite.ts`, `lib/enrichment/ownerFromBusinessName.ts`,
`lib/enrichment/ownerResolution.ts`) starts from Google review replies, which
means either adding Outscraper as a second provider alongside Places, or
finding an equivalent reviews source through the Places API. Resolve this
data-source question before estimating the rest of this phase's size.

**The hallucination-verification gate
(`lib/extraction/extractWithVerification.ts`) is the single most valuable
pattern in On Radar and must be preserved exactly, not simplified during the
port.** Every non-null value a model returns must carry a verbatim quote from
the exact text it was shown; if that quote isn't a literal substring of the
source text, the value is discarded and logged as a hallucination rather than
trusted. This is what lets `OWNER_SURFACE_THRESHOLD` (80, in
`lib/scoring/config.ts`) stay precision-optimized — real data from a real
run showed the confidence model discriminating correctly even when the
surfacing decision needed tuning (see the "Known tradeoffs" section of
On Radar's own README) — and it's the mechanism that makes a surfaced owner
name trustworthy enough to read off a call screen without double-checking it
live. A simplified version of this gate is not an acceptable substitute; port
`extractWithVerification.ts` as-is, including its test suite
(`lib/extraction/*.test.ts`) and the live-API smoke test pattern in
`scripts/inspect-extraction.ts`.

Add `owner_name`, `owner_confidence`, and the underlying `owner_candidates`
table (sub-threshold candidates stay stored and visible, never discarded —
matching On Radar's own design) to the JARVIS side.

### 5. Call View

Last. A dedicated calling screen in JARVIS's Business → Pipeline UI, reusing
the existing detail-drawer pattern already used elsewhere (per the original
lead-research spec's own UI conventions) rather than porting On Radar's
`app/call/page.tsx` wholesale. Scope this once 1–4 are live and there's a
real, validated, owner-attributed, deduped list worth calling from — building
the screen before the data underneath it is trustworthy is working on the
wrong end of the pipeline.

## What this plan explicitly does not do

- Does not touch `lib/research/*`, `actions/lead-research-actions.ts`, or the
  `lead_research` / `research_runs` tables — the existing pipeline runs
  unmodified throughout every phase above.
- Does not drop the website-audit/PageSpeed/opportunity-scoring capability —
  it stays as-is; calling-motion data (phone, dedup, independence, owner)
  layers onto the same `lead_research` rows as new columns, not a schema
  replacement.
- Does not adopt SQLite or a second database — everything ports into
  JARVIS's existing Supabase schema.
- Does not build Call View before the data feeding it is validated.
- Does not start any of this before Sep 9.

## Open question for whoever picks this up

Phase 4 needs a reviews data source decision (Outscraper vs. an equivalent via
Places) before its size can be estimated — that's the first thing to resolve
when this plan is reopened, not something to guess at now.
