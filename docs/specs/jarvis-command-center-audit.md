# JARVIS Command Center — Phase 1 Audit

Status: **audit only, no functional changes.** This document is the input to
Phases 2–8.

Audited against `main` @ `95d228b`, with all nine donor repositories cloned
and read (not judged from their READMEs).

---

## 0. What is already done

Phases 2, 3 and 4 of the requested plan, plus part of Phase 5, shipped in
PR #1 and are merged. This audit does not re-plan them.

| Requested phase | State |
|---|---|
| 2 — Design system | **Done.** 40 primitives (was 18), validated categorical palette, `KpiGrid`/`KpiCell`, `DeltaBadge`, `text-metric` step, `tabular` utility |
| 3 — App shell | **Done.** `ui/sidebar` with cookie-backed collapse, grouped nav, breadcrumbs, `cmdk` palette |
| 4 — Home | **Partly.** Rebuilt onto the new grid + KPI block. Still summarises only what JARVIS already stores; no cross-module "today" spine yet |
| 5 — Modules | **Finance, University, Mentor, Voice rebuilt** (UI). Business, Health, Goals, Tasks, YouTube, Memory, Settings untouched |
| 6 — Integrations | **Not started.** One seam documented (`lib/voice/use-speech-recognition.ts`) |
| 7 — Cross-module AI | **Not started** — but far closer than it looks. See §5 |
| 8 — QA | Green on current `main`: build clean, `tsc` clean, eslint 0 errors, 65/65 tests |

One correction to the brief's framing: **Phase 2's "use AdminCN as the visual
foundation" is done, but not from AdminCN.** The shadcnstudio template is the
version-matched primitive donor; the *design language* actually adopted came
from `arhamkhnz/next-shadcn-admin-dashboard`, which you supplied later and
which is the stronger reference. Both are recorded here so the next session
doesn't "restore" the wrong one.

---

## 1. Current architecture

```
Next 16.2.12 · React 19.2.4 · Tailwind 4 · @base-ui/react 1.6 · TypeScript 5
Supabase (Postgres, service-role only — no auth, single user)
Netlify (5 scheduled functions) · Gemini + Anthropic providers
```

| Surface | Count |
|---|---|
| Page routes | 33 |
| API routes | 9 |
| Server-action files | 21 |
| Query modules (`lib/db/queries`) | 15 |
| Components | ~160 |
| Migrations | 35 |
| Live tables | **54** (59 created, 5 since dropped) |

**No authentication exists.** Migration `0012_remove_auth.sql` removed it;
`lib/supabase/server.ts` uses the service-role key with no per-request
session. Access control is a site-level password in `proxy.ts`. This is a
single-user app and every "Settings → Account/Security" idea in the brief has
to reckon with that.

**Integrations do not live in one place.** There is no `lib/integrations/`.
They are scattered: `lib/providers/workout/` (Hevy), `lib/youtube/` (OAuth +
upload), `lib/research/` (Places, PageSpeed), `lib/sms/`, `lib/obsidian/`,
`lib/ai/providers/`. The brief's proposed `lib/integrations/<service>` layout
is a real improvement and should be adopted — as a **move**, not a rewrite.

---

## 2. Existing functionality that must be preserved

Non-negotiable. All of this is working, non-trivial, and has no equivalent in
any donor repo:

- `lib/uni/grades.ts`, `lib/uni/study-plan.ts`, `lib/uni/schedule-occurrences.ts` — weighted grading, risk scoring, "plan tonight". **Tested.**
- `lib/db/queries/life-score.ts` — the life-score engine feeding Home.
- `lib/research/` — the entire lead-research pipeline (Places → PageSpeed → AI qualification), with audit trail, rate limiting, budget tracking, and a Netlify job runner.
- `lib/ai/context-builder.ts` — cross-module context assembly (see §5).
- `lib/youtube/oauth.ts` + `upload.ts` — resumable YouTube upload, deliberately built to dodge Netlify's ~6MB function-body ceiling.
- `lib/obsidian/` + `scripts/obsidian-sync.mjs` — wikilink/backlink sync.
- The 5 Netlify scheduled functions (mentor daily/weekly, lead research).
- All 54 tables and 35 migrations.

Tests exist for: `uni-grades`, `uni-schedule-occurrences`, `date`,
`persona-clock`, `anthropic-client`, `gemini-client`, `anthropic-lead-qualifier-bisection`, `proxy-ungated-prefix`. **65 assertions. Do not break these.**

---

## 3. Donor repositories — verdict per repo

Read at source, not from README claims.

| Repo | Stack | License | Verdict |
|---|---|---|---|
| **shadcnstudio** | Next 16.2.6, React 19.2.4, `@base-ui` 1.6, Tailwind 4 | MIT | **Primitive donor — already used.** Exact stack match |
| **arhamkhnz** (added later) | Next 16.3, `radix-ui`, `@shadcn/react`, zod 4 | MIT | **Design-language donor — already used.** Primitives NOT drop-in (radix vs base-ui) |
| **brightspace-lms-js** | TS, published npm package | MIT | **Install it.** Real OAuth2 + version negotiation. Do not hand-roll |
| **HevyAPI** (`hevy-api`) | TS, published npm package | MIT | **Install it.** Supersedes our hand-rolled `lib/providers/workout/hevy-client.ts` |
| **youtube-automation** | **Go** + React UI | *(none found)* | **External service.** Has a documented OpenAPI: **36 endpoints**. Cleanest integration target of the nine |
| **nextcrm-app** | Next 16.2.6, React 19.2.4, **Prisma 7 + Mongo/PG**, radix | MIT | **Reference only.** ~90 Prisma models; data layer fundamentally incompatible with our supabase-js queries |
| **mission-control** | **Python/FastAPI** + Postgres/pgvector | *(none found)* | **Concept donor or sidecar.** 14 API modules, YAML-defined agents |
| **wealthfolio** | **Rust + Tauri** desktop | **AGPL-3.0** | **Look, don't copy.** Confirmed — copying obliges publishing JARVIS under AGPL |
| **forks-ai/jarvis** | **Python** (Whisper + ElevenLabs + Hermes) | MIT | **External service.** Seam already documented |
| **hermes-agent-web** | Next 16, React 19, Tailwind 4, shadcn | *(none found)* | **Pattern donor** for the agent/tool UI |

**Two repos ship no LICENSE file** (`youtube-automation`, `mission-control`,
`hermes-agent-web`). Absent a license, default copyright applies — **no
copying**. Integrate over HTTP or reimplement from behaviour. This is a real
constraint, not a formality.

### The install that is currently blocked

`npm i brightspace-lms hevy-api` was **denied by the sandbox classifier** in
this environment. Both are the correct choice and both are MIT. This must be
run locally before Phase 6 University/Health work can start.

---

## 4. Duplicate functionality to consolidate

Three genuine overlaps. Each needs a decision *before* code, or we build the
same thing twice:

1. **Tasks.** JARVIS has `/life/tasks`, `/life/habits` (routine), `tasks` + `habits` + `habit_logs` tables, and a working priority widget. mission-control has projects/kanban/timeline/agenda. → **Keep JARVIS's schema; borrow mission-control's *views* (kanban, timeline, agenda).** Do not migrate to their model.
2. **Business.** JARVIS has `deals`, `contacts`, `contracts`, `pipeline_stages`, `activities`, `deal_tasks`, plus the lead-research pipeline nextcrm has no equivalent for. → **Keep JARVIS's schema; borrow nextcrm's *entity coverage* selectively** (notes, activity feed, richer contact model). Its ~90 models are mostly invoicing/campaigns/email you did not ask for.
3. **Goals.** `/life/goals` exists standalone; the brief wants Health→Goals and Finance→Goals contribution. → Needs a **goal-source abstraction**, which does not exist yet. This is new work, not consolidation.

Also worth cleaning: `prayers`, `prayer_logs`, `ghl_connections`,
`ghl_sync_logs`, `yt_thumbnails` are created then dropped by later
migrations (`0029`, `0031`, `0033`). Harmless, but they inflate any schema
read.

---

## 5. The Mentor finding — Phase 7 is much closer than the brief assumes

The brief asks for a tool layer (`get_tasks`, `create_task`,
`get_finance_summary`, …) as if from scratch. Two things already exist:

1. **`lib/ai/context-builder.ts` already reads 19 query functions across every module** — accounts, transactions, deals, contacts, contracts, pipeline stages, courses, assessments, workouts, nutrition, tasks, routine, journal, memory, trades, research leads. Cross-module *read* plumbing is done; it is just being flattened into a prompt string instead of exposed as callable tools.

2. **`MentorProvider` already implements a tool-use protocol.** `chatWithNutritionTools` drives the two-call tool loop with `log_nutrition_entry`, and deliberately keeps execution in the caller (`lib/ai/mentor.ts`) so the DB write stays out of the provider interface.

So Phase 7 is: **generalise one working tool into a registry**, and reuse
context-builder's queries as the read tools. That is a substantially smaller
and safer job than the brief implies — and it means the confirmation gate for
destructive actions belongs in the *executor*, next to the existing pattern,
not in the provider.

---

## 6. Proposed architecture

Additive. Nothing below requires rewriting a working backend.

```
lib/
  integrations/          ← NEW home; move existing clients here
    brightspace/         ← npm brightspace-lms + adapter + token store
    hevy/                ← npm hevy-api  (replaces lib/providers/workout/)
    youtube-automation/  ← typed client over the Go service's OpenAPI
    voice/               ← transport interface; browser impl today
  ai/
    tools/               ← NEW: registry, schemas, executor, confirmation gate
      registry.ts        ← name → {schema, handler, requiresConfirmation}
      read/*.ts          ← wrap lib/db/queries (reuse context-builder's calls)
      write/*.ts         ← gated: create_task, update_lead, create_event
  db/queries/            ← unchanged
```

Rules carried forward from what already works:
- Every integration behind an interface, as `LeadQualifierProvider` and `MentorProvider` already do — swapping a vendor means one new class and one line in `index.ts`.
- Secrets stay server-side (`server-only` import, as `hevy-client.ts` does).
- Every integration ships a **disconnected state**, not a crash. `hasHevyKey()` is the existing precedent.

---

## 7. Integration dependencies (what blocks what)

```
npm i brightspace-lms hevy-api   →  University sync, Health sync
Brightspace OAuth credentials    →  real course/grade data
Hevy Pro API key                 →  real workout data
Go service running + reachable   →  YouTube automation panel
Python voice service (optional)  →  server-side STT; browser works without it
AI tool registry                 →  every "Everything → AI Mentor" item
Goal-source abstraction          →  Health→Goals, Finance→Goals
```

Nothing in Phases 2–5 is blocked. **Everything in Phase 6 is blocked on
credentials or a running external service** — which is why each must ship its
disconnected state first.

---

## 8. Risks

1. **Scope.** This brief is many sessions of work. The failure mode is a half-migrated app: nine modules each 60% converted. Mitigation: land one module at a time, green, merged, before starting the next.
2. **Rewriting working backends for aesthetics.** The brief forbids it and it is the single easiest mistake here — nextcrm and mission-control both invite wholesale schema replacement. §4 fixes the boundary in advance.
3. **Licensing.** Wealthfolio is AGPL; three donors have no license at all. Copying from any of them contaminates a proprietary codebase. Integrate or reimplement.
4. **Fabricated data.** The brief explicitly forbids fake persistent data. Every disconnected integration must render an honest empty/connect state. The Finance KPI work already set this precedent — no delta is shown where no comparison exists.
5. **No auth.** "Settings → Account/Security" and any multi-user idea are incoherent until auth returns. Flag before building UI for it.
6. **Unverified against real data.** Nothing in PR #1 has been seen with a live database. Finance's `availableCash` filter (`cash` + `savings`, excluding investments) is an assumption that will render as a plausible wrong number, not an error.

---

## 9. Recommended order

Ordered by (value × confidence) ÷ blockers:

| # | Work | Blocked by |
|---|---|---|
| 1 | Verify PR #1 against real data | Supabase credentials |
| 2 | `lib/integrations/` restructure (move, no rewrite) | — |
| 3 | AI tool registry + read tools; gate writes | — |
| 4 | Business CRM depth (kanban, activity, notes) | — |
| 5 | Tasks & Routine (kanban/timeline/agenda views) | — |
| 6 | Health — `hevy-api` swap | npm install |
| 7 | University — Brightspace adapter + connect state | npm install, then OAuth creds |
| 8 | Home — cross-module "today" spine | 3–7 |
| 9 | Settings — integration status board | 6, 7 |
| 10 | YouTube panel over the Go OpenAPI | service running |
| 11 | Voice — optional server STT | Python service |

Items 2–5 are unblocked today and are where the next session should start.
