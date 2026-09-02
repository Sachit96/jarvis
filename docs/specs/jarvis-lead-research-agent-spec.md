# JARVIS — Lead Research Agent (buildable spec)

Build a lead research pipeline inside JARVIS that discovers local businesses, audits their web presence, scores the opportunity, and inserts qualified leads into the **existing Business → Pipeline** — not a parallel CRM.

This replaces my earlier draft. Where this conflicts with anything I said before, this wins.

## Architecture decision — read first

This is a three-stage pipeline, and each stage uses the right tool instead of pretending web search can do everything:

1. **Discovery** → Google Places API (New). Real structured data: name, phone, website, address, rating, review count, radius search. This is the only legitimate way to get the filters I want (min/max reviews, radius). Do not scrape Google Maps HTML, and do not touch Yelp — its ToS prohibits scraping.
2. **Audit** → server-side fetch of each business's website (respecting robots.txt), extract signals, plus the **PageSpeed Insights API** (free) for real performance numbers.
3. **Qualification** → one LLM call per business that turns the raw signals into an audit summary, opportunity list, and score. Use the Anthropic API key already configured for the AI Mentor; model `claude-sonnet-4-6`; require JSON output validated with Zod (use `lib/validation.ts` patterns).

Runs are **on-demand jobs**, not "continuous research." I click Run, a job processes N businesses, I see progress, it finishes. No cron, no daemon.

### Phase 0 — before writing code

1. Tell me the two env vars you need (`GOOGLE_PLACES_API_KEY`, `PAGESPEED_API_KEY` — the latter can reuse the same Google Cloud key with the API enabled) and exactly where in Google Cloud Console I enable each API. I'll set them up while you build.
2. Inspect the existing pipeline/leads schema in Supabase and report what columns exist, so research fields extend the existing table (or a linked `lead_research` table keyed to the pipeline row) rather than duplicating name/phone/email/status.
3. Confirm the plan for both, then build.

## Data model

Extend the existing pipeline lead (or create `lead_research` with a FK to it — your call after Phase 0, justify it):

- `source` = 'research_agent'
- `industry`, `city`, `region`, `country`, `postal_code`, `maps_url`
- `google_place_id` (unique — this is the dedupe key)
- `rating`, `review_count`
- `audit` jsonb — the full structured audit (signals + LLM analysis)
- `score` int 0–100, `score_breakdown` jsonb
- `opportunities` text[] — from the fixed taxonomy below
- `ai_summary` text — 2–3 sentences, written for a cold-call opener
- `researched_at` timestamptz

Migration file + RLS policies matching the project's existing pattern (same as we did for `memory_entries` — policies in the migration this time, not after).

**Dedupe:** upsert on `google_place_id`. If a place was researched < 30 days ago, skip and count it as "cached" in the run summary. Re-research only with an explicit "force refresh."

## Stage 1 — Discovery

Input form (this replaces "AI natural-language search" for v1 — structured inputs are more reliable and faster to build; NL parsing can be layered on later):

- Business type / keyword (free text → Places `textQuery`)
- City + province/state + country (→ location bias)
- Radius (km, default 25)
- Min reviews / max reviews (filter client-side on Places results — few reviews often means low digital maturity, which is my buyer)
- "Must have a website" toggle (both directions are useful: no-website businesses are new-website prospects)
- Max results per run: default 10, hard cap 25 (keeps a run under ~5 minutes and API costs trivial)

Places API details: use Text Search (New) with field mask limited to what we store — id, displayName, formattedAddress, location, rating, userRatingCount, websiteUri, nationalPhoneNumber, googleMapsUri, businessStatus. Skip anything not `OPERATIONAL`.

Note: Places does not return email addresses. Email extraction happens in Stage 2 from the website (mailto links + visible text on contact/about pages only). If no email is found, the field stays null — **never fabricate contact info.**

## Stage 2 — Website audit

For each business with a website, fetch the homepage server-side (10s timeout, one retry, honest UA string, respect robots.txt — if disallowed, record `audit_blocked: true` and move on). Extract mechanical signals:

- HTTPS yes/no; valid cert
- Viewport meta tag (mobile-responsiveness proxy)
- Title + meta description present and non-generic (SEO basics)
- Detectable CTA: tel: links, mailto:, form tags, "book"/"quote"/"estimate" button text
- Booking system fingerprints (Calendly, Housecall Pro, Jobber, ServiceTitan script tags)
- Chat widget fingerprints (Intercom, Drift, Tidio, Facebook chat)
- Copyright year in footer (staleness signal)
- Framework fingerprints (Wix/GoDaddy/Squarespace vs custom)
- Image count / alt-text ratio (accessibility proxy)
- Social links present
- Testimonials/reviews section (heuristic: "testimonial", "review", star markup)

Then one PageSpeed Insights call (mobile strategy) → performance score, LCP. If PageSpeed fails or is slow, don't block the run — record null and continue.

No website at all is not a failure — it's the strongest opportunity signal there is. Record it and skip to Stage 3.

## Stage 3 — LLM qualification

One call per business. Input: the Places record + all Stage 2 signals. Output (JSON, Zod-validated):

```
{
  audit_summary: string,        // what's wrong/right, concrete, no fluff
  opportunities: string[],      // from the fixed list below, each with a one-line why
  score_breakdown: {
    website_quality: 0-30,
    conversion_readiness: 0-25, // CTAs, booking, forms, chat
    seo_basics: 0-15,
    performance: 0-15,          // from PageSpeed
    digital_presence: 0-15      // socials, reviews volume, branding signals
  },
  score: 0-100,                 // sum — compute in code, don't trust the model's math
  ai_summary: string            // 2-3 sentences I can read before dialing
}
```

Opportunity taxonomy (fixed list, not free text, so it's filterable): `new_website`, `website_redesign`, `booking_system`, `ai_chatbot`, `ai_receptionist`, `crm_followup`, `review_automation`, `seo`, `paid_ads`, `social_media`.

Scoring is **opportunity-inverted**: a *worse* web presence scores *higher*, because the score means "how good a prospect is this for me," not "how good is their website." State this in the UI so future-me isn't confused. The system prompt for this call must include: never invent facts not present in the signals; if signals are thin (e.g., audit_blocked), say so and score conservatively.

## The run itself

- A `research_runs` table: id, params, status (queued/running/done/failed/cancelled), counts (found/audited/inserted/skipped_cached/failed), started/finished timestamps, error log jsonb.
- Process businesses sequentially or with concurrency of 2–3 max — be a polite client, and at N≤25 this still finishes in minutes.
- Each business is independently try/caught: one broken site must never kill the run. Failures land in the error log with the URL and reason.
- Cancellation: a cancel button flips status; the loop checks it between businesses. That's the whole "resume" story for v1 — a cancelled run's completed leads are already saved.
- Live progress: poll the run row every 2s from the client (no websockets for v1).

Given Next.js serverless limits on Netlify, check the max function duration before choosing where this runs. If a 25-business run can exceed the limit, process in batches of 5 via a self-invoking pattern or run it as a background function — tell me which you chose and why in the Phase 0 report.

## UI — one page: `/business/lead-research`

Use the existing JARVIS dark theme, existing Card/Table components, existing spacing tokens. No new design language, no new dependencies for UI.

Layout:

1. **Run panel** (top): the discovery form + Run button + the current/last run's progress bar and counts. While running: "Auditing 7 of 12 — Bianchi Roofing…"
2. **Results table**: business, city, score (badge, color-banded: 70+ hot / 40–69 warm / <40 skip), top 2 opportunity tags, phone, researched date. Sortable by score. Filters: score band, opportunity tag, city, has-email.
3. **Detail drawer** (reuse the Memory drawer pattern): full contact block with click-to-call `tel:` link, the ai_summary at top, score breakdown as labeled bars, full audit signals, opportunities with their whys, link to the pipeline entry, a notes field writing to the existing pipeline notes.
4. **Row actions**: "Move to Pipeline stage →" (they're inserted at the first stage by default; this promotes), "Force refresh", "Dismiss" (soft-hide, sets a flag, doesn't delete).
5. **Export**: CSV only for v1 — columns: business, phone, email, website, city, score, top opportunities, ai_summary. That's a call sheet. No Excel/PDF/JSON until I ask.

Dashboard tie-in: the Business card on Home gets one extra row — "Research leads: N hot" linking here. Nothing else on Home changes.

## Explicitly out of scope for v1 (do not build)

- Natural-language search parsing (structured form instead)
- Continuous/scheduled research
- PDF/Excel/JSON export
- Multi-source directory scraping (Places + the business's own site is the whole pipeline)
- Outreach/emailing from this page (CASL implications — separate work order later)
- Screenshots of prospect sites

## Verification

- Run a real search: "roofing companies, Toronto, 25km, max 200 reviews, 10 results." Show me the run summary and the populated table.
- Prove dedupe: run the identical search again; expect ~all skipped as cached.
- Prove failure isolation: include a business whose site times out; the run must complete and log it.
- Confirm inserted leads appear in the existing Business → Pipeline UI with source = research_agent.
- Confirm RLS: the table is inaccessible with the anon key and readable through the app.
- Total cost sanity check: report the approximate Places + PageSpeed + LLM cost of one 10-business run.

Report after Phase 0, then after Stage 1–3 backend works end-to-end (before UI), then when the page is done.
