# Standalone Lead Research Scraper — new project, not part of JARVIS

A single CLI script. Run it, it searches, audits, scores, and writes a CSV.
No database, no web server, no deployment. This is deliberately the
simplest possible version of the JARVIS lead research agent — same pipeline
logic, none of the app infrastructure.

## Stack

- Node.js + TypeScript, run via `tsx` (no build step)
- Zod for validating the LLM's output
- No framework, no database, no UI

## Setup

```bash
mkdir lead-scraper && cd lead-scraper
npm init -y
npm install typescript tsx zod dotenv csv-stringify
npx tsc --init
```

`.env`:
```
GOOGLE_PLACES_API_KEY=
PAGESPEED_API_KEY=
GEMINI_API_KEY=
```

## What to build — one file is fine, split only if it gets unwieldy

`run.ts`, invoked like:

```bash
npx tsx run.ts --keyword "roofing" --city "Toronto" --region "ON" --country "Canada" --radius 25 --max 10
```

### Stage 1 — Discovery (Google Places API, Text Search New)

- Resolve "city, region, country" to a lat/lng centroid with one Places call, then search with the keyword alone plus a `locationRestriction` circle — Places silently ignores location bias when the query text already names a place, so keep the keyword and the location separate.
- Field mask limited to exactly what you use: id, displayName, formattedAddress, location, rating, userRatingCount, websiteUri, nationalPhoneNumber, googleMapsUri, businessStatus.
- Filter to `businessStatus === "OPERATIONAL"`.
- `--max` caps results, default 10, hard cap 25 so a run finishes in minutes and stays well inside free-tier quota.

### Stage 2 — Website audit (plain fetch, no API cost)

For each business with a website:
- Fetch the homepage (10s timeout, one retry, honest User-Agent, respect a blanket `Disallow: /` in robots.txt — skip and mark blocked if so)
- Extract: HTTPS, viewport meta tag, title/meta description, CTA presence (tel:/mailto:/form/booking-language), booking-system and chat-widget fingerprints (Calendly, Jobber, Intercom, etc. — regex on the HTML), footer copyright year, framework fingerprint (Wix/Squarespace/WordPress/Shopify), image count + alt-text ratio, social links, testimonials section, extracted email (mailto: first, then a **conservative** fallback — only search text inside byte ranges near the words "contact"/"email"/"reach us", not the entire raw HTML, to avoid grabbing platform or tracking-script addresses)
- No website is a valid, strong signal, not a failure — record it and skip straight to qualification with no audit data.
- One PageSpeed Insights call per site (mobile strategy) for a real performance score + LCP. Never block the run if this fails — record null and continue.

### Stage 3 — Qualification (one Gemini call per business)

- `responseMimeType: "application/json"` + `responseSchema` for structured output, Zod validation on top as the real safety net (schema is a request-time hint, not a guarantee — verify the response actually parses, don't just trust it was accepted)
- Fixed opportunity taxonomy, not free text: `new_website`, `website_redesign`, `booking_system`, `ai_chatbot`, `ai_receptionist`, `crm_followup`, `review_automation`, `seo`, `paid_ads`, `social_media`
- Score breakdown, five categories summing to 100 — website_quality (30), conversion_readiness (25), seo_basics (15), performance (15), digital_presence (15) — **compute the total in code, never trust the model to add its own numbers**
- Scoring is opportunity-inverted: a *worse* web presence scores *higher*, since the score means "how good a prospect for my services," not "how good is their website." State this in the CSV header comment so it's not confusing weeks from now.
- System prompt must say: never invent a fact not present in the signals; if the site was unreachable or robots-blocked, say so explicitly and score conservatively.
- Sequential, not concurrent — one business at a time. This is the important part for staying on free tier: no concurrency means no risk of bursting past a per-minute rate limit. Slower, but it's a script you kick off and walk away from, not a live user waiting on it.
- On a 429, catch it, print "Rate limited — waiting 60s" and actually wait 60s before retrying that one business, up to 3 attempts. Don't kill the whole run over one rate limit.

### Output

One CSV per run, named `leads-{keyword}-{city}-{date}.csv`, columns:

```
business_name, phone, email, address, website, google_maps_url,
rating, review_count, score, top_opportunities, ai_summary,
website_quality, conversion_readiness, seo_basics, performance,
digital_presence, audit_blocked, notes
```

Sort rows by score descending — highest-opportunity leads at the top, ready to work down the list.

### Console output while it runs

```
Searching: roofing companies near Toronto, ON, Canada (25km)...
Found 10 businesses.

[1/10] Bianchi Roofing — auditing website...
[1/10] Bianchi Roofing — scoring...
[1/10] Bianchi Roofing — score: 72 (warm) ✓

[2/10] ...
```

### Error handling

- One broken business (site timeout, malformed response) must never kill the whole run — catch per-business, log the reason in the `notes` column, move to the next one.
- If Places or Gemini auth fails outright (bad key), fail fast with a clear message rather than silently producing an empty CSV.

### What NOT to build

No database, no dedupe/caching between runs, no web UI, no concurrency, no export formats besides CSV, no scheduling. If this proves useful and you want it wired permanently into JARVIS later, that's a different, bigger conversation — this is deliberately the fast, cheap, disposable version.

## Cost/quota reality check

At `--max 10` with sequential calls: 1 Places call (+1 for the centroid) + up to 10 PageSpeed calls (free) + up to 10 Gemini calls. That's roughly 10 Gemini requests per run — comfortably inside free-tier per-day limits even if you run this several times in a day, as long as you're not also hammering the JARVIS Mentor with the same key at the same time.
