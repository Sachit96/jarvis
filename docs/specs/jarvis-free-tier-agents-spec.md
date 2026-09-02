# JARVIS — Free-tier model tiering + making agents actually autonomous

Two work orders. A unlocks ~29x the daily request budget at zero cost. B is the one that turns built-but-manual features into things that run on their own.

---

# WORK ORDER A — Tiered model routing

## The opportunity

Google AI Studio's free tier (same key, same endpoint you already use) has wildly different limits per model:

| Model | RPD | RPM | TPM |
|---|---|---|---|
| gemini-3.5-flash-lite (current) | 500 | 15 | 250K |
| gemma-4-31b-it | 14,400 | 30 | 16K |
| gemma-4-26b-a4b-it | 14,400 | 30 | 16K |

Same `generativelanguage.googleapis.com` REST endpoint, same `GEMINI_API_KEY`.

## Phase 0 — verify before building, report back

Do not assume any of the following. Check the official Gemini API docs and confirm each empirically with a real call using my key:

1. **Exact API model IDs** for the Gemma 4 models. The AI Studio rate-limit table shows display names; the API strings differ. Confirm the real ones.
2. **Does Gemma support `responseSchema`** (structured JSON output)? My understanding is it does not — verify. This determines whether the daily brief and lead qualifier can move.
3. **Does Gemma support function calling / `tools`?** Same question — this determines whether the nutrition chatbot can move.
4. **Does Gemma support `systemInstruction`?** `lib/ai/persona.ts` injects the JARVIS persona this way on every call. If unsupported, the persona has to be prepended into the user turn instead.
5. **Measure a real prompt against the 16K TPM ceiling.** Run `buildMentorContext()` for my actual data, count the tokens, and tell me whether a full mentor chat turn even fits. If it doesn't, Gemma is unusable for that path regardless of the other answers.

**Report all five findings before writing code.** Several of them may kill parts of this plan, and I'd rather know than have you work around it silently.

## The routing, assuming Gemma lacks JSON/tools

Extend `lib/ai/providers/gemini-client.ts` from a single `GEMINI_MODEL` constant to a small capability-based router. Keep it dumb — a lookup table, not an abstraction layer.

```
TIER_HIGH_VOLUME  → gemma-4-31b-it      (plain text, no JSON, no tools, small context)
TIER_STRUCTURED   → gemini-3.5-flash-lite (responseSchema, function calling, big context)
```

Route each existing call site by what it actually needs:

| Call site | Needs | Tier |
|---|---|---|
| Lead qualifier (`qualifyLeads`) | responseSchema, batched | STRUCTURED |
| Nutrition chatbot | function calling | STRUCTURED |
| Daily brief / weekly review | structured JSON output | STRUCTURED (unless you can rewrite it to parse plain markdown reliably — if so, move it) |
| General mentor chat (text + voice) | plain text, but large context | **Test this one specifically.** If context fits in 16K TPM, this is the biggest win — it's the highest-frequency call. If not, keep on STRUCTURED. |

Do not route by "importance" or guesswork — route by the two hard capability questions (does it need JSON, does it need tools) and the token ceiling. Document the reason in a comment at each call site.

## Budget tracking must become per-tier

`gemini_usage` currently enforces one shared 500/day counter across everything. That's now wrong — the two tiers have separate quotas. Change the table to track usage per model (add a `model` column to the primary key), and enforce each tier's real limit independently. The voice HUD's budget row should show whichever tier is closest to its ceiling, not a single blended number.

## Fallback behaviour

If a STRUCTURED-tier call 429s because the 500/day is exhausted, do **not** silently fall back to Gemma for a call that needs JSON — it will return unparseable output and fail confusingly. Fail with a clear "structured model budget exhausted, resets at midnight UTC" message instead. Only fall back between tiers when the capability requirements genuinely allow it.

---

# WORK ORDER B — Make the agents autonomous

This is the higher-value half. The audit is correct that JARVIS has no agent framework — but the real gap isn't a framework, it's that **nothing runs unless I click a button.**

`app/api/mentor/run/route.ts` is fully built, Bearer-token gated via `CRON_SECRET`, and accepts `?kind=daily|weekly`. Nothing in the repo calls it. It is currently dead code.

## B1 — Wire up a real scheduler (do this first, it's small)

Add a **Netlify Scheduled Function** (free on my plan, unlike Background Functions which we already confirmed work) that POSTs to `/api/mentor/run`:

- Daily brief: every morning, roughly 6am my time (America/Toronto) — note Netlify cron is UTC, so compute the right UTC hour and comment the conversion so DST doesn't silently shift it
- Weekly review: Sunday evening

Requirements:
- Send `Authorization: Bearer ${CRON_SECRET}` — the route already checks this
- Use `process.env.URL` for the base URL, never hardcode the deploy domain
- Log the outcome somewhere I can see it (a `scheduled_runs` table or just the existing error-log pattern) — a silent failing cron is worse than no cron
- Confirm from the Netlify deploy log that the scheduled function actually registered, same verification discipline as the Background Function

Once this works, the daily brief is a genuine autonomous agent: it wakes up, pulls cross-module context, reasons, and leaves me something to read. That single change is most of what "agents" means for a solo operator.

## B2 — Recurring lead research

Same pattern. The Lead Research pipeline is fully built and 100% manually triggered. Add:

- A saved-search concept: store run params (`keyword`, `city`, `radius`, etc.) with an `enabled` flag and a cadence
- A scheduled function that fires enabled saved searches weekly
- Dedupe already exists via `google_place_id` — a repeat run should mostly skip-as-cached, which is exactly right
- Cap it hard: one saved search per week, max 25 businesses, so it can't quietly eat the Places quota or the STRUCTURED-tier budget

## B3 — Follow-up watchdog (new, small, high value)

The cheapest genuinely useful agent given my situation, and it barely needs an LLM:

- Daily, find deals that haven't changed stage in N days (default 5)
- Find contacts with no `activities` row in N days
- Write the findings into the daily brief context so JARVIS surfaces them unprompted: "Three deals have gone quiet — Bianchi Roofing hasn't moved in 9 days."
- Most of this is a SQL query, not a model call. Only the phrasing needs an LLM, and it rides along on the existing daily brief call rather than adding a new one.

## What NOT to build

- No agent framework, orchestrator, planner, or multi-step tool loop. Every one of these is a scheduled function calling existing code. Resist the urge to build abstraction ahead of a second real use case.
- No new LLM calls for B3 — it piggybacks on the brief.
- Nothing that writes to my pipeline or finances autonomously without me seeing it first. Agents surface and suggest; I decide.

---

# Order

Do Work Order A Phase 0 first and report the five findings — several may change the plan. Then B1, which is small and unlocks the most. Then A's routing, then B2/B3.

Report after each, with what you verified live rather than what you reasoned about.
