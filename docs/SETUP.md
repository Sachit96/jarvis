# JARVIS — setup and operations

Everything needed to take this repository from a clone to a running,
connected system. No secret values appear here or should ever be added.

Three commands answer "is it set up?" at any point, in increasing order of
what they need:

```bash
npm run check-config       # which variables are set — no network, no credentials needed
npm run integration:check  # read-only: does each configured integration actually work?
npm run operator:live      # does the real model really drive the 39 tools?
```

`integration:check` needs only the credentials for whatever you want tested —
it reports every integration as PRESENT / MISSING / INVALID / NOT APPLICABLE,
never prints a value, and mutates nothing. **INVALID is the one to care
about**: it means a credential exists but the integration could not be used.

`operator:live` additionally needs `GEMINI_API_KEY`, because it is the only
part of the suite that proves the model itself selects and executes tools.
Read-only by default; `-- --with-writes` adds the create/update/complete
journey and the confirmation gate, both of which operate solely on records
tagged with that run's own id.

### What must never be confused

| Claim | What establishes it |
| --- | --- |
| the code supports it | `npm test` |
| tested against a real database | `npm run integration:check` |
| the real model invoked it | `npm run operator:live` |
| the real integration worked | `integration:check` returning PRESENT for that integration's authenticated read |

Passing tests do not make any of the last three true.

### Verified live, 2026-09-09

The first end-to-end run against the real model and the real database:

| | |
| --- | --- |
| Read matrix | **22/23** prompts selected an acceptable tool |
| Tools exercised by the model | 13 of 39 (read-only run — no write was attempted) |
| Fabrication | **none** — empty finance reported as not connected, no stale deals reported as none, Hevy unconnected reported as unsynced |
| Write journey + confirmation gate | **NOT RUN** — needs `-- --with-writes` |

Two bugs had to be cleared to get there, and both are worth knowing about
because neither was visible to any offline test:

- The operator was routed to a free-tier Gemma endpoint that failed
  non-deterministically — 500 and 503 on identical payloads, once on plain
  text with no tools at all. It now runs on `structured`.
- The provider rebuilt the model's turn from `{name, args}`, discarding the
  `thoughtSignature` a thinking model requires back verbatim. Every
  multi-round turn failed with a 400 until it echoed the model's own parts.

The remaining unproven path is the one that matters most for safety: no
high-risk tool has yet been confirmed, declined, or executed against a live
model.

---

## 1. Environment variables

`.env.local.example` is the authoritative list and explains where each value
comes from. `npm run check-config` reports every one as **configured** or
**missing** — it never prints a value, so its output is safe to paste into an
issue.

### Core — the app does not work without these

| Variable | Why |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | The only key this app uses. There is no authentication and no RLS — see §9. |
| `SITE_PASSWORD` | HTTP Basic gate over the whole deployment (`proxy.ts`). **Unset means the site is public**, and it holds real finance and health data. |

### AI

| Variable | Why |
| --- | --- |
| `GEMINI_API_KEY` | The AI Mentor, Voice Mode, the operator, and Lead Research qualification. Without it those surfaces render as "not configured" rather than failing. |
| `ANTHROPIC_API_KEY` | Optional. Only an alternate lead qualifier, used while lifetime spend is under the cap set in Settings. |

### Integrations

| Variable | Why |
| --- | --- |
| `HEVY_API_KEY` | Workout sync. Requires Hevy Pro. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `OWNER_PHONE_NUMBER` | Inbound SMS logging. **All four or nothing** — the webhook silently no-ops until every one is set. |
| `GOOGLE_PLACES_API_KEY`, `PAGESPEED_API_KEY` | Lead Research discovery and audit. |
| `CRON_SECRET` | Bearer token the scheduler sends to `POST /api/mentor/run`. |

### Voice

Voice Mode needs **no credentials**. It uses the browser's built-in Web Speech
API for both recognition and synthesis, so it works offline of any vendor —
but only in browsers that implement it (Chrome and Edge; Safari partially).
The speech layer is deliberately isolated in `lib/voice/` so a hosted STT/TTS
provider can replace it later without touching the operator.

---

## 2. Database migrations

Migrations live in `supabase/migrations/` and are applied **in filename
order**. They are plain SQL, so any of these work:

```bash
supabase db push                                   # Supabase CLI, linked project
psql "$DATABASE_URL" -f supabase/migrations/0036_routine_cadence.sql
```

Then regenerate the types, which are checked in:

```bash
supabase gen types typescript --linked > lib/supabase/database.types.ts
```

### One migration is deliberately opt-in

`0029_drop_prayers.sql` is **destructive and not part of the standard
sequence**. It drops `prayers` and `prayer_logs`, which have had no UI since
migration 0011. Take the JSON backup from Settings first if you still want
that data. The rest of the app is unaffected either way: the export tolerates
both tables being absent, and nothing else reads them.

### Verifying before you apply

The whole chain has been verified by applying `0001`–`0037` to a scratch
Postgres 16 cluster and probing the resulting constraints. To repeat that:

```bash
initdb -D /tmp/qa && pg_ctl -D /tmp/qa -o "-p 55432" start
# create the `extensions` and `auth` schemas Supabase provides, then:
for f in supabase/migrations/*.sql; do psql -p 55432 -v ON_ERROR_STOP=1 -f "$f"; done
```

---

## 3. Gemini

1. Get a key at <https://aistudio.google.com/apikey>.
2. Set `GEMINI_API_KEY`.
3. Confirm: `npm run check-config` shows Gemini **connected**.
4. Prove it end to end: `npm run operator:live`.

Two model tiers are used, tracked and budgeted separately, and a call is never
silently re-routed between them — see `lib/ai/providers/gemini-client.ts`.
Exceeding a tier's daily budget surfaces to the user as "I've used up today's
AI quota", not as an error.

---

## 4. Hevy

1. Hevy Pro → <https://hevy.com/settings?developer> → copy the API key.
2. Set `HEVY_API_KEY`. It is read server-side only and never reaches the
   browser.
3. Sync runs from the Health pages and on the dashboard.

Unset is a supported state, not a broken one: workouts you log by hand are the
source of truth regardless, and every health tool reports the sync state
alongside its data so JARVIS can say "this is only what you logged manually"
instead of concluding you stopped training.

---

## 5. Local development

```bash
npm install
cp .env.local.example .env.local     # then fill it in
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm test` | Full suite. Needs no credentials. |
| `npx tsc --noEmit` | Typecheck. |
| `npm run lint` | ESLint. |
| `npm run build` | Production build. |
| `npm run check-config` | Environment readiness. No credentials needed. |
| `npm run integration:check` | Read-only connectivity per integration. |
| `npm run operator:live` | Live model + database QA. Needs a Gemini key. |

`npm run operator:live` is read-only by default. `-- --with-writes` adds the
create/confirm/delete journey; it creates its own records and deletes them,
and never touches anything it did not create.

---

## 6. Production deployment

Deployed on Netlify. `scripts/check-env.mjs` diffs `.env.local` against
Netlify's environment (fingerprints only — secret-scoped variables are
unreadable by design, so those are checked for presence and context coverage
only).

Five scheduled functions run in `netlify/functions/`. They call the site's own
API and need `CRON_SECRET` to match.

Before a deploy:

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Set `SITE_PASSWORD` before the first public deploy. This app has no user
authentication at all.

---

## 7. Integration status meanings

One vocabulary, defined in `lib/integrations/status.ts` and used identically by
Settings, Home, Voice and the AI tools — so what the page claims and what
JARVIS says in conversation cannot diverge.

| State | Meaning | Who acts |
| --- | --- | --- |
| **connected** | Credentials present *and*, for OAuth integrations, a grant actually exists. | Nobody. |
| **disconnected** | The app is registered but nobody has authorised it. | You, one click. |
| **configuration_required** | Credentials, an OAuth app, or a registration are missing. | You, or an administrator. |
| **syncing** | A sync is in flight. | Wait. |
| **error** | Configured, but the last interaction failed. | Investigate. |
| **unavailable** | Cannot work here at all. | Nothing to do. |

Two rules this system exists to enforce:

- **No integration reports `connected` merely because its adapter exists.**
  Client credentials are an app *registration*, not a *connection*; only a
  stored grant earns `connected`.
- **An unusable integration never produces substitute data.** Tools return an
  explicit `integration_unavailable` with the state and a message, which is
  what stops the model from narrating an empty result as though the data were
  real.

### A note on security posture

JARVIS has **no authentication and no RLS** — migration 0012 removed it. One
fixed dataset, one owner. Everything is gated by `SITE_PASSWORD` at the edge
and by the service-role key staying server-side. `tests/security-guards.test.ts`
enforces the latter on every commit: no client component may read a non-public
environment variable, no secret value may reach a log line, no `eval`, and no
dynamically-built table name in the tool layer.
