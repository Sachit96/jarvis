# JARVIS — Work Orders: identity, search, form validation, memory, layout regression

Five independent work orders. Do them in the order listed. **Report after each one** rather than doing all five and reporting once — C in particular will surface things I need to decide on.

---

# WORK ORDER A — Sidebar identity

The sidebar footer currently reads "JARVIS / Personal workspace" with a generated "J" avatar. Change it to my actual identity.

- Name: **Sachit**
- Secondary line: **Personal workspace** (keep as-is)
- Avatar: image at `public/avatar.jpg`, rendered as a 32px circle, `object-cover`, with a 1px `border-white/10` ring
- Fall back to the initial "S" on a solid background if the image fails to load — use `onError` to swap, don't let a broken image icon render

Do **not** change the sidebar header ("JARVIS / Personal OS") — that's the product name and stays.

Pull the name and avatar path from a single source of truth (a `user` config object or the profile record in the DB, whichever already exists) rather than hardcoding the string in the sidebar component. If neither exists, create `lib/user.ts` exporting `{ name: "Sachit", workspace: "Personal workspace", avatar: "/avatar.jpg" }` and consume it in the sidebar. Grep for any other place the app displays a user name or generated initial and point it at the same source.

Also: there's a floating "Rendering .." pill in the bottom-left corner overlapping the sidebar footer area. Identify what renders it. If it's a dev-only indicator, gate it behind `process.env.NODE_ENV === "development"`. If it's a real loading state, move it out of the sidebar's stacking context so it stops overlapping the user block.

---

# WORK ORDER B — Global search (currently non-functional)

The header search input ("Search anything…" with the ⌘K hint) does nothing. Wire it up properly.

**Behavior:**

- The header input is **not** a real input. Make it a button styled to look like an input. Clicking it, or pressing ⌘K / Ctrl+K anywhere in the app, opens a command palette overlay. This is why the current one feels broken — a text field that captures focus but has no handler is worse than a button.
- Palette opens centered, `max-w-[560px]`, with a backdrop blur. Escape closes. Clicking the backdrop closes.
- Single text input at the top. Results below, grouped by source with a section label:
  - **Goals** — title, current %
  - **Tasks** — title, due date, priority dot
  - **Habits / Routine** — name, today's completion state
  - **Notes** — title, last-updated
  - **Memory** — title, category (see Work Order D)
  - **Finance** — transaction description, amount
  - **Pages** — static nav destinations (Business, Health, Finance, Goals, Tasks & Routine, AI Mentor, Memory, Settings)
- Matching: case-insensitive substring on title/name fields to start. Do not add a fuzzy-search dependency unless the substring version feels bad in use — if you do, use `fuse.js` and say so.
- Cap at 5 results per group, 20 total. Show a count when truncated.
- Full keyboard control: ↑/↓ move through the flattened result list (skipping group headers), Enter opens the highlighted result, ⌘K again toggles closed. The highlighted row must be visibly distinct and must scroll into view.
- Empty query state: show "Pages" group plus the 5 most recently modified items across all sources.
- No results state: "No matches for '<query>'" plus a hint that ⌘K searches goals, tasks, notes, and memory.
- Selecting a result navigates to that item's detail route. If an item has no detail route yet, navigate to its parent page — do not render a dead link.

**Check whether a search input exists on other pages too** (Business, Health, Finance, Memory). If any of them are also non-functional, either wire them to filter that page's local list, or remove them. A visible input that does nothing is worse than no input.

---

# WORK ORDER C — Form validation is broken app-wide

This is the highest-priority item. See the attached screenshot of the "Log weight" modal: date `2026-07-29`, weight `154`, body fat blank — and it returns **"Invalid input"** and refuses to save. That data is valid. Several other forms in the app behave the same way.

## Most likely root cause — verify this first

The error text "Invalid input" is Zod's default message for a failed `z.number()`. The probable chain:

1. `<input type="number">` with an empty value returns `""`, not `undefined`.
2. That `""` gets passed through `parseFloat()`/`Number()` or React Hook Form's `valueAsNumber`, producing **`NaN`**.
3. The schema declares something like `bodyFatPct: z.number().optional()`.
4. `.optional()` only permits `undefined`. **`NaN` is not `undefined`, and `z.number()` explicitly rejects `NaN`** — so the optional field fails validation even though the user correctly left it blank.
5. The form surfaces a single form-level "Invalid input" instead of a field-level error, so there's no way to tell which field failed.

That would exactly reproduce the screenshot: weight is fine, the blank *optional* field is what's killing the submit.

## The fix

Create one shared coercion helper and use it for every numeric input in the app:

```ts
// lib/validation.ts
import { z } from "zod";

/** Turns "" / null / NaN from a number input into undefined, else a real number. */
export const numericInput = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? undefined : n;
}, z.number());

export const optionalNumericInput = numericInput.optional();
```

Then: `weightLbs: numericInput.positive("Enter a weight above 0")`, `bodyFatPct: optionalNumericInput.pipe(z.number().min(1).max(70)).optional()`.

Apply the same treatment to dates. A `<input type="date">` yields a `"YYYY-MM-DD"` string, which fails `z.date()`. Either keep dates as strings validated with `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`, or use `z.coerce.date()`. Pick one convention and use it everywhere.

## Error presentation

Regardless of the underlying cause, the current error UX is unacceptable and must change:

- Every validation error renders **next to the field that failed**, in 12px red, directly below that input, with `aria-describedby` wired to the input and `aria-invalid` set.
- The failing input gets a red border.
- Never render a bare "Invalid input" — every schema rule gets a written message in plain language that says what's wrong and what's expected: "Enter a weight above 0", "Body fat must be between 1 and 70", "Pick a date".
- Form-level errors (server failures, save conflicts) render above the submit button and are visually distinct from field errors.
- The submit button shows a pending state and is disabled while a save is in flight, so it can't double-submit.

## Full audit — this is the part I actually need

Walk the entire app and **fill out and submit every form and click every button**, with both valid and empty-optional data. Do not just read the code — actually exercise it in the browser. For each one, record:

| Location | Control | Filled with | Result | Verdict | Fix applied |
|---|---|---|---|---|---|

Cover at minimum, and add anything I've missed:

- **Health → Body**: Log weight (the known-broken one), log sleep
- **Health → Workouts**: add workout, add exercise, add set, edit/delete
- **Health → Nutrition**: log meal, set calorie target, log protein
- **Business**: add deal/pipeline entry, edit deal stage, log revenue, anything on Business Dashboard
- **Finance**: add asset, add liability, add income, add expense, edit any of them
- **Goals**: create goal, edit goal, update progress %, mark complete, delete
- **Tasks & Routine**: create task, set priority, set due date, complete task, add habit, check off habit, edit routine
- **Memory**: create/edit/delete entries
- **AI Mentor**: "Ask AI" button, "View Full Brief" link
- **Settings**: every field on every tab
- **Global**: the ⊕ button in the top-right header (what is it supposed to do? it appears unwired), every "View all" / "→" link on the dashboard

For every button, confirm it (a) has an onClick or href, (b) actually reaches its target, (c) shows a loading/disabled state during async work, and (d) surfaces a real error message on failure. **Report any button whose destination route does not exist** — dead links are as bad as broken forms.

Where a control is intentionally not built yet, either remove it from the UI or give it a visible "Coming soon" disabled state. Don't leave live-looking controls that do nothing.

---

# WORK ORDER D — Redesign the Memory module

Memory is currently presented as a flat list of untyped documents (`scoring`, `mentor-prompt`, `templates`, `memory-protocol`, `metrics`), which tells me nothing about what's in them or why they exist. For a personal OS whose whole value is an AI that knows me, this is the most under-designed surface in the app.

## Information architecture

Give every memory entry a **type**, and let type drive the presentation:

| Type | What it holds | Example |
|---|---|---|
| `fact` | Stable truths about me | "Based in Toronto", "Runs a white-label agency" |
| `preference` | How I want things done | "Prefers direct feedback, no hedging" |
| `person` | People and my relationship to them | A client, a hire, a mentor |
| `project` | Active initiatives with a status | "42-day $70k cash sprint" |
| `protocol` | Instructions the AI must follow | `memory-protocol`, `scoring`, `mentor-prompt` |
| `reference` | Reusable material | `templates`, `metrics` |

Each entry: `id`, `type`, `title`, `body`, `tags[]`, `source` (`manual` | `captured`), `pinned`, `createdAt`, `updatedAt`, optional `confidence`, optional `expiresAt`.

## Page layout

Three regions:

1. **Header strip — "What JARVIS knows"**: entry count, count by type as small pills, and the timestamp of the most recent capture. One line, no chart. This answers "is my memory actually being maintained" at a glance.
2. **Left rail (200px)**: type filters with counts, a Pinned filter, a tag list, and a `source` toggle (Manual / Auto-captured / All). Selected filter state lives in the URL query so views are linkable.
3. **Main region**: entry cards in a 2- or 3-column responsive grid. Each card shows a type badge (color-coded, consistent with the type table above), title, a 3-line clamp of the body, tags, relative updated time ("2h ago"), and a pin toggle on hover. Pinned entries sort first and get a subtle accent border.

Clicking a card opens a **right-side drawer** (480px, slides in, Escape closes) with the full body rendered as markdown, full metadata, edit/delete, and — importantly — a **"Referenced by"** section listing where this memory has been used (which mentor briefs, which pages). If you don't have that data yet, stub the section with an honest empty state rather than omitting it; it tells me what to instrument next.

## Two view modes

Toggle in the header:

- **Library** (default) — the filtered grid described above
- **Timeline** — reverse-chronological by `updatedAt`, grouped by day, showing what was learned or changed and when. This is the view that makes memory feel alive rather than like a folder.

## Details that matter

- Inline creation: a persistent "Add memory" input at the top of the grid that expands into a form on focus. Type defaults to `fact` and is changeable.
- Every entry is editable in place; edits update `updatedAt`.
- Deleting asks for confirmation and explains the consequence ("JARVIS will stop using this in briefs").
- Empty state per filter, written as an invitation: "No preferences saved yet. Add one so JARVIS stops guessing how you like things done."
- The dashboard's "RECENT NOTES" card should read from this same store, show the type badge next to each title, and its "Full Timeline →" link should deep-link into the Timeline view.
- The ⌘K palette (Work Order B) searches title, body, and tags.

If the current data model has no `type` field, write a migration that backfills: `memory-protocol`, `scoring`, `mentor-prompt` → `protocol`; `templates`, `metrics` → `reference`. Don't discard existing content.

---

# WORK ORDER E — Layout regression from the last pass

The equal-height columns worked — all four column bottoms now align. But the filler cards are absorbing space without filling it, so the voids just moved. Current state at 1920px:

- **Today's Routine** — content ends at "Journal", roughly **210px of empty card** below it
- **Health** — content ends at "Calories Today", roughly **260px of empty card** before the pinned "Health →" link
- **Goals** — grew to 14 entries and is now the tallest element on the page; it's what's forcing every other column to stretch

Root cause: `flex-1` gives a card `flex: 1 1 0%`, but if the card's *content* is unbounded and has no internal scroll, the card contributes its full natural height to the column and drives the row height up. Goals is doing exactly this.

Fixes:

1. Every filler card gets `overflow-hidden` on the card and `min-h-0 overflow-y-auto` on its scrollable list child. Without both, the card grows instead of scrolling.
2. **Goals**: cap the visible list. Show the 6 nearest-deadline or lowest-completion goals, with the list scrollable and "All Goals →" pinned at the bottom via `mt-auto`. It should never be the tallest card on the page.
3. Set a **row height ceiling** on the dashboard grid: `2xl:max-h-[calc(100vh-220px)]` on the four-column grid so the whole dashboard fits roughly one viewport with the habit history below the fold. Every column scrolls internally rather than the page scrolling to 1600px.
4. **Health**: once the row height is bounded, its void shrinks on its own. If any remains, promote it out of filler duty — make `RECENT ACTIVITY` the only filler in that region, since a centered empty state fills space gracefully and a metric list does not.
5. Re-run the verification from the previous spec: column bottoms within 2px, and now additionally — **no card has more than 24px of empty space below its last content element.** That check is what failed this round.

---

# Reporting

After each work order, tell me: files changed, what you verified in the browser (not just what you wrote), and anything in the spec you deviated from and why. For Work Order C, the audit table is the deliverable — I want to see the full list even for controls that turned out to be fine.
