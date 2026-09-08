# JARVIS

A personal command centre — tasks, goals, finance, business, university,
health and memory in one place, with an AI operator that can actually read and
change the data rather than just talk about it.

Built on Next.js 16, React 19, Tailwind 4 and Supabase.

## Getting started

```bash
npm install
cp .env.local.example .env.local     # then fill it in
npm run dev
```

Then open <http://localhost:3000>.

**[docs/SETUP.md](docs/SETUP.md)** is the full guide: environment variables,
migrations, each integration, deployment, and what the integration states
mean.

## The operator

JARVIS exposes 39 tools to the model through a static whitelist
(`lib/ai/tools/registry.ts`). Every model-initiated call passes one gate:

```
MODEL → SELECTION → VALIDATION → RISK GATE → HANDLER → RESULT
```

Nothing in that path trusts the model. Names resolve through a registry, so an
invented one reaches no code. Arguments are parsed by the tool's own Zod
schema, so nothing malformed reaches a query. High-risk tools stop until the
*caller* — never the model — marks a call confirmed, and one approval
authorises exactly one execution with the arguments the user actually saw.

There is no raw SQL, no arbitrary query, and no dynamic table name anywhere in
the tool layer, and `tests/security-guards.test.ts` fails the build if that
changes.

## Checks

```bash
npm test                  # full suite, no credentials needed
npx tsc --noEmit
npm run lint
npm run build
npm run check-config      # what this environment can actually do
npm run operator:live     # live model + database QA (needs credentials)
```

The first four run anywhere. The last two are the difference between "the
gates hold" and "the system works" — see `docs/SETUP.md`.
