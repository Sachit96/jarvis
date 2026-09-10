# UI audit

Every route in JARVIS, rendered at desktop and mobile and screenshotted.

- **70 screenshots** — 35 routes × 2 viewports.
- **Desktop** 1512×950, **mobile** 390×844, both full-page.
- **`report.json`** is the manifest: one row per route naming its two files,
  with the render result for each.

## How these are produced

    node scripts/ui-preview/qa.mjs --mode prod --scenario populated \
      --viewport desktop,mobile --naming audit --out artifacts/ui-audit

The harness boots a stub PostgREST over fixture data
(`scripts/ui-preview/fixtures.mjs`), runs a real production build, and drives
the real routes in Chromium. Production rather than `next dev` because this
sandbox's HMR websocket fails its handshake, and with it the dev bootstrap —
the page renders its server HTML and then never hydrates, which makes every
client component look broken. The `hydrated` flag in the manifest is what
proves that is not happening.

Filenames come from `PAGE_NAMES` in the harness, so re-running overwrites in
place rather than accumulating a second set under different names.

## What `render: "pass"` means

Stricter than "a file was written". A viewport passes only when it returned
HTTP 200, threw no error, hydrated, had zero horizontal overflow, sized every
chart, logged no page error, and made no failed request.

Two classes of network noise are excluded as environmental rather than
app failures, and both are the sandbox: the webfont CDN sits behind a
TLS-inspecting proxy (`ERR_CERT_AUTHORITY_INVALID`), and Next aborts its own
route prefetches on navigation (`ERR_ABORTED`).

## Data

Fixtures, not real records — every string is prefixed `SAMPLE`. Nothing in
these screenshots comes from a live account, and no integration is connected:
where a screen depends on an external service, it shows that service's real
unconfigured state.
