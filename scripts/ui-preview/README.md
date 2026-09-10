# UI preview harness (visual QA only)

This directory exists so the interface can be **rendered in a real browser**
without a Supabase project. It is not part of the application build and is
never imported by anything under `app/`, `components/` or `lib/`.

## Why it exists

The design phase before this one proved that reading CSS is not QA: two
defects (glass blur silently dropped by Lightning CSS, and a later
`--gradient-brand` override rendering every gradient cyan) were correct in
the source and wrong on screen. So every visual change now has to be looked
at in a browser.

## What it does

`server.mjs` is a **stand-in for PostgREST**. `next dev` is pointed at it via
`NEXT_PUBLIC_SUPABASE_URL`, so the real routes, the real server components
and the real queries all run unmodified — they simply talk to this process
instead of a database.

## What it is NOT

- It is **not** connected to any real database, and it never will be: it has
  no driver and no credentials.
- It **never writes anywhere.** `POST`/`PATCH`/`DELETE` are accepted and
  discarded so a page that renders a form does not explode; nothing is
  persisted, in memory or otherwise.
- The rows in `fixtures.mjs` are **openly synthetic** and are labelled as
  such in the data itself (names like "SAMPLE — …"). They exist to make
  populated layouts visible. They must never be presented as the user's
  data, and no production code path can reach them.

## Modes

QA runs against a **production build** by default (`--mode prod`), which is
both more faithful and necessary here: under `next dev` this sandbox's HMR
websocket fails its handshake and the page then never hydrates, so every
client component renders its server HTML and no effect ever runs. Charts, the
scroll-aware command bar and anything else driven by an effect all look
broken while being entirely fine. `--mode dev` is kept for fast iteration on
pure-CSS changes, where hydration does not matter — the report records
whether the page hydrated either way.

## Usage

    node scripts/ui-preview/server.mjs --port 54321 --scenario populated

then run `next dev` with

    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
    SUPABASE_SERVICE_ROLE_KEY=ui-preview-not-a-real-key

`scripts/ui-preview/qa.mjs` does both plus drives Chromium.

Scenarios: `empty` (every table returns no rows — the honest first-run state
the real dashboard is in today) and `populated`.
