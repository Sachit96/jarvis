# JARVIS — Overnight Build: complete work order

I'm asleep. Work through all of this unattended. Every decision below is pre-approved — **do not stop to ask me anything.** Where you'd normally check in, take the option marked RECOMMENDED and note it in your morning report.

---

# OPERATING RULES FOR UNATTENDED WORK

1. **Never leave the app broken.** After each work order, run typecheck, lint, and a full route sweep (all existing routes must still load with no console errors). If a work order breaks something and you can't fix it in 15 minutes, revert that work order's changes and move on. A missing feature is fine; a broken JARVIS is not.

2. **Commit after every completed work order**, with a clear message. If something goes wrong at 4am, I want the earlier work preserved, not one giant unmergeable diff.

3. **You cannot apply migrations.** You have no Postgres connection or Supabase access token — this has been true all session. Write every migration as a numbered file in `supabase/migrations/`, never attempt to run it, and **hand-patch `lib/supabase/database.types.ts`** so code compiles. At the very end, produce ONE consolidated list of every migration I need to run in the morning, in order, with a one-line description of each. This is the single most important item in your morning report.

4. **No new API keys exist tonight.** I have not added Twilio, YouTube OAuth, or Anthropic credentials. For every feature needing them: build the full code path, read credentials from `process.env` only, and follow this codebase's established graceful-degradation convention (same as Hevy/GHL/Gemini) — the feature renders as "not configured" and no-ops rather than throwing. Do not stub with fake data, do not hardcode placeholder keys.

5. **Respect the free-tier budget.** All new LLM calls route through the existing tiering: Gemma tier (`gemma-4-31b-it`, 14,400/day) for plain text and tool-calling; Flash-Lite (`gemini-3.5-flash-lite`, 500/day) only where nested/enum `responseSchema` reliability is required. Every new call site must increment `gemini_usage`. If a feature would need more than ~50 calls/day in normal use, redesign it to need fewer.

6. **Don't build abstraction ahead of need.** No agent frameworks, no orchestrators, no plugin systems. Concrete implementations that follow the existing patterns in `actions/`, `lib/db/queries/`, `lib/validations/`, `components/`.

7. **Don't touch what works.** Finance OS, Life OS, Business OS, Health OS, Memory, Voice Mode, and Lead Research are all working. Extend them where specified; don't refactor them.

---

# PRIORITY ORDER — if you run out of time or context, finish in this order

1. Work Order 1 (finish outstanding agent work) — small, closes existing loops
2. Work Order 2 (UniOS core) — the biggest ask, most value
3. Work Order 3 (UniOS intelligence layer)
4. Work Order 4 (YouTube research/script/thumbnail — fully buildable tonight)
5. Work Order 5 (SMS engine — buildable, inert until keys)
6. Work Order 6 (Anthropic provider — buildable, inert until key)
7. Work Order 7 (YouTube upload path — mostly inert, lowest value tonight)

Stop and write the morning report with at least 20% context remaining. A good report on 5 finished work orders beats a truncated report on 7.

---

# PRE-APPROVED DECISIONS

- **UniOS location:** a new domain *inside* JARVIS at `/uni`, own tables, reusing existing auth gate, Gemini tiering, memory system, and design tokens. Not a separate app.
- **Trading bot:** no integration. It's a separate project. Do not touch `trades`/`market_analyses`.
- **YouTube publishing:** uploads default to `privacyStatus: "private"` with a manual approve-to-publish step in the UI. RECOMMENDED and approved.
- **SMS provider:** Twilio.
- **Anthropic target:** the lead qualifier only (its nested/enum schema failed 3/3 on Gemma). Everything else stays on Gemini.
- **Anthropic spend cap:** hard-required. Track real dollar spend, refuse calls past a configurable ceiling, default $3.
- **Ambiguous parsing:** never guess. Fall back to a journal/note entry and say so.
- **New tables:** RLS enabled, zero policies, matching the `lead_research`/`research_runs`/`gemini_usage` precedent. Comment the divergence.

---

# WORK ORDER 1 — Finish outstanding agent work

Complete whatever of these isn't already done:

- **Gemma routing (Work Order A):** daily brief, weekly review, general mentor chat, nutrition chatbot → Gemma tier. Lead qualifier stays Flash-Lite. Defensive markdown-fence strip before every `JSON.parse`. `gemini_usage` tracks per-model with independent per-tier limits. Voice HUD budget row shows whichever tier is closest to its ceiling. On a Flash-Lite 429, fail clearly — never silently fall back to Gemma for a call needing JSON or tools.
- **503 handling:** Gemma's free endpoint returned `503 UNAVAILABLE ("high demand")` twice during earlier testing. Make sure retry/backoff treats 503 identically to 429. Verify this code path exists.
- **Burst behaviour:** Gemma does mandatory hidden thinking tokens (74–367 observed, un-disableable). Verify a real multi-turn voice conversation doesn't blow the 16K TPM ceiling — test back-to-back turns, not isolated calls.
- **B2 — recurring lead research:** saved-search concept (stored run params + enabled flag + cadence), scheduled function fires enabled searches weekly. Cap: one search/week, max 25 businesses. Dedupe already exists via `google_place_id`.
- **B3 — follow-up watchdog:** daily SQL query for deals with no stage change in 5+ days and contacts with no `activities` row in 5+ days. Feed findings into the existing daily-brief context so JARVIS surfaces them unprompted. **No new LLM call** — it rides along on the brief.
- **Commit the uncommitted Voice Mode mobile fixes** (`neural-map.tsx`, `voice-mode-client.tsx`) if still uncommitted.

---

# WORK ORDER 2 — UniOS core

New domain at `/uni`. This is the largest piece. Build the foundation properly; the intelligence layer (WO3) sits on top.

## Tables

- `uni_courses` — code, name, professor, professor_email, room, description, term, color, credit_weight, target_grade, archived
- `uni_schedule_blocks` — course_id, type (`lecture`|`tutorial`|`lab`|`office_hours`), day_of_week, start_time, end_time, room
- `uni_assessments` — course_id, title, type (`assignment`|`quiz`|`midterm`|`final`|`presentation`|`participation`), due_at, weight_pct, max_score, earned_score, status (`not_started`|`in_progress`|`submitted`|`graded`), estimated_hours, difficulty (1–5), notes, source (`manual`|`syllabus`)
- `uni_assessment_requirements` — assessment_id, requirement text, completed bool, sort_order (the rubric/deliverable checklist)
- `uni_study_sessions` — course_id, assessment_id nullable, planned_start, planned_minutes, actual_minutes, completed bool, notes
- `uni_materials` — course_id, title, type (`slides`|`notes`|`reading`|`practice_exam`|`syllabus`|`other`), body text, uploaded_at
- `uni_deadlines` — university-wide, non-course: title, due_at, category (`enrolment`|`withdrawal`|`tuition`|`osap`|`exam_period`|`break`|`other`), notes

Foreign keys to `uni_courses` with `on delete cascade` where appropriate. Indexes on `due_at`, `course_id`, and status columns.

## Pages

- `/uni` — semester dashboard: today's classes, next 7 days of deadlines, overdue items, current semester average, per-course grade + risk chips, "most important thing right now"
- `/uni/courses` — course list, create/edit
- `/uni/courses/[id]` — per-course dashboard: schedule, assessments with grades, materials, current grade, target vs. actual, what's needed on remaining assessments
- `/uni/calendar` — combined view of all assessments + deadlines + schedule blocks. Day/week/month views. Reuse `react-day-picker` (already a dependency). Drag-and-drop is NOT required tonight — skip it, note it as future.
- `/uni/assessments` — flat sortable list across all courses, filterable by status/course/urgency
- `/uni/deadlines` — university-wide deadline tracker

## Grade engine (`lib/uni/grades.ts`)

Pure functions, no LLM:
- `courseGrade(assessments)` — weighted current grade from graded items only
- `semesterAverage(courses)` — credit-weighted
- `neededOnRemaining(course, targetGrade)` — what average is required on ungraded assessments to hit target; returns `impossible` when it exceeds 100
- `simulate(course, hypotheticalScores)` — the "what if I get 70% on the midterm" simulator
- `bestCase` / `worstCase` — assuming 100% / 0% on everything remaining
- `riskScore(course)` — 0–100, factoring current grade vs. target, weight remaining, overdue count, days to next deadline

Write these as pure, well-tested-by-construction functions. This is the highest-value non-AI code in UniOS — everything else depends on it being correct.

## Navigation

Add UniOS to `lib/nav-items.ts`. Desktop sidebar gets a "University" entry. Mobile BottomNav is capped at 5 items by existing design comment — swap the least-used entry rather than adding a 6th, and note what you swapped in the report.

---

# WORK ORDER 3 — UniOS intelligence layer

## Syllabus parsing (highest-value AI feature in UniOS)

- Upload a syllabus (PDF or pasted text) on a course page
- Gemini file/text input, **Flash-Lite tier** (needs reliable structured output)
- Extract: assessments with due dates, weights, types; professor info; schedule blocks; required readings; key policies
- Zod-validated output, defensive fence-strip before parse
- **Show a review screen before writing anything.** Extracted items appear as an editable list I confirm — never write directly to `uni_assessments` from a parse. Parsing errors that silently become wrong deadlines are worse than no parsing.
- Explicitly report what it *couldn't* parse rather than silently dropping it
- Detect date conflicts (two assessments same day) and flag them on the review screen

## Assignment breakdown

- Paste assignment instructions on an assessment → Gemini extracts deliverables into `uni_assessment_requirements` as a checklist, estimates hours, suggests a multi-day work plan writing `uni_study_sessions`
- Same review-before-write pattern

## Study planning

- Given available hours ("I have 3 hours tonight"), produce a concrete session plan across courses, weighted by: days to deadline, grade weight, current risk score, estimated hours remaining
- **Most of this is arithmetic, not LLM.** Compute the ranking in code; use one Gemini call only to phrase the result conversationally. Do not ask the model to do the prioritization math.

## Academic risk engine

- Daily, compute `riskScore` per course (pure function, no LLM)
- Detect overloaded weeks (multiple high-weight items within 7 days)
- Surface in the daily brief alongside the business/health/finance context — extend `lib/ai/context-builder.ts` to include UniOS data
- Extend the existing daily brief prompt to cover academics. No new scheduled function; reuse the one built in B1.

## Study material Q&A

- Ask questions against `uni_materials` for a course
- Simple approach: pass relevant material bodies as context, Gemma tier. No vector DB, no embeddings — the volume doesn't justify it and it would blow the token ceiling. If materials exceed the context window, select by course + recency and say which ones were used.

## Flashcards / quizzes

- Generate from a `uni_materials` entry, Gemma tier, plain-text output parsed into Q/A pairs
- Store in a `uni_flashcards` table (material_id, question, answer, last_reviewed, ease, next_review)
- Basic spaced repetition: simple interval doubling on correct, reset on incorrect. Do not implement full SM-2 tonight.

## Command bar

Extend the existing ⌘K CommandPalette to accept natural-language UniOS commands ("add QMS assignment due Friday", "what should I do tonight"). Route through one Gemma tool-calling call with declarations for: `create_assessment`, `complete_assessment`, `plan_tonight`, `grade_check`. Ambiguous → fall back to search, never guess.

---

# WORK ORDER 4 — YouTube: research, scripts, thumbnails

Fully buildable tonight — no YouTube API needed for any of this.

## Tables
- `yt_scripts` — topic, niche, research_summary, hook, script_body, sections jsonb, estimated_runtime_sec, suggested_titles text[], status (`draft`|`approved`|`used`), created_at
- `yt_thumbnails` — script_id, prompt, image_url or base64 ref, selected bool

## Research + script (`/youtube`)
- Web search the topic for current formats and angles (reuse the search pattern from Lead Research)
- **Paraphrase only.** Never reproduce transcripts, scripts, or substantial text from any source. Summarize approaches in your own words.
- One Flash-Lite call → hook, timestamped sections, runtime estimate, 1 suggested title + 3 alternatives
- Zod-validated, fence-stripped

## Thumbnails
- `Imagen 4 Generate` on the existing `GEMINI_API_KEY` — **25 requests/day free**, separate quota from text models
- Generate 3 variants per script from a prompt derived from the hook/title
- Track usage in `gemini_usage` under its own model key so it doesn't consume text budget
- Never generate images of real identifiable people, copyrighted characters, or brand logos

---

# WORK ORDER 5 — SMS logging engine (Twilio)

Build complete, inert until keys exist.

Env vars (add to `.env.local.example`, documented): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `OWNER_PHONE_NUMBER`.

`app/api/sms/webhook/route.ts`:
- Twilio POSTs form-encoded, not JSON
- **Validate `X-Twilio-Signature`** via Twilio's HMAC scheme against the auth token. Reject mismatches. Non-negotiable.
- **Allowlist `From` against `OWNER_PHONE_NUMBER`.** Anything else → empty TwiML, no processing.
- Rate guard: max ~20 processed messages/hour
- Parse via Gemma tool-calling with declarations: `log_workout`, `log_nutrition` (reuse the existing nutrition tool exactly), `complete_task`, `log_study_session` (UniOS), `add_journal_entry`
- **Ambiguous → `add_journal_entry` with raw text**, and say so in the reply
- Reply with TwiML one-line confirmation matching the nutrition chatbot's existing confirmation style

Add a Settings card showing SMS connection status — "not configured" until env vars exist.

---

# WORK ORDER 6 — Anthropic provider (inert until key)

- New `AnthropicLeadQualifier` implementing the existing `LeadQualifier` interface in `lib/ai/providers/`
- Endpoint `https://api.anthropic.com/v1/messages`, header `x-api-key`, `anthropic-version` header required
- Env var `ANTHROPIC_API_KEY`. **Do not hardcode a model string from memory** — put it in one exported constant with a comment that it needs verifying against current docs before first real use.
- **Hard spend cap, required:** new `anthropic_usage` table tracking real dollar spend (compute from returned token counts × per-MTok rates in a constants table, since cost varies by tokens not request count). Refuse calls past a ceiling, default $3, configurable in Settings.
- `getLeadQualifier()` returns the Anthropic implementation **only when `ANTHROPIC_API_KEY` is set AND spend is under cap**; otherwise falls back to the existing Gemini one. Never fail because Anthropic isn't configured.
- Note in a comment: Anthropic has **no ongoing free tier** — one-time trial credit then pay-per-token. This is the only paid path in the app; treat it accordingly.

---

# WORK ORDER 7 — YouTube upload path (mostly inert)

Lowest priority. Build only if the above is genuinely complete.

- OAuth2 flow: consent screen redirect, token exchange, refresh-token storage in a `yt_connections` table
- `videos.insert` call path, `privacyStatus: "private"` default
- A "Connect YouTube" Settings card, inert without OAuth credentials
- **Document the quota reality in a comment:** YouTube Data API v3 gives 10,000 units/day; `videos.insert` costs 1,600 → hard ceiling ~6 uploads/day regardless of tier
- An "approve to publish" UI action that flips privacy to public

---

# MORNING REPORT — write this before you stop

1. **The migration list.** Every migration file I need to run, in order, with one line each on what it does. Most important item.
2. What's complete and verified working.
3. What's built but inert pending keys (and exactly which env var unlocks each).
4. What you skipped or reverted, and why.
5. Every decision you made where the spec was ambiguous.
6. Anything you found that concerns you — broken existing behaviour, a bad assumption in this spec, a feature that fought you. Be blunt; I'd rather read it than discover it.
7. Any place you had to guess at an API's current behaviour without being able to verify it live.
