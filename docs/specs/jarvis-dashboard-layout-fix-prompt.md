# Task: Fix the JARVIS dashboard "Today" page layout — eliminate ragged column bottoms and dead space

## Context

The `/` (Today / Home) dashboard renders correctly but the layout is broken in a specific, structural way. Read this whole brief before editing anything. Do not start with cosmetic changes.

**Root cause (this is the actual bug — fix this, not the symptoms):**
The dashboard cards are laid out in a grid where each card sizes to its own intrinsic content height. The columns therefore terminate at four different Y positions, leaving large empty regions at the bottom of the short columns. Previous attempts to "reduce padding" or "remove dead space" failed because the padding was never the problem — the problem is that **no card in any column is allowed to absorb leftover vertical space.**

**The fix pattern, in one sentence:** each of the 4 dashboard columns becomes a full-height flex column, and exactly one card per column is marked `flex-1` so it grows to consume whatever space is left. The grid stretches all columns to the height of the tallest one.

---

## Phase 0 — Investigate first, report before editing

1. Locate the Today/Home dashboard page component and every card component it renders. Likely paths: `app/page.tsx`, `app/(dashboard)/page.tsx`, `components/dashboard/*`. List every file you will touch.
2. Tell me what the current layout primitive is: CSS grid with `grid-auto-rows`, a masonry library, `columns-*` (CSS multi-column), absolute positioning, or hardcoded heights. **If it is CSS `columns-*` or a masonry lib, delete it entirely** — those cannot produce equal-height columns and are the likely culprit.
3. Grep for and list every hardcoded `height:`, `h-[Npx]`, `max-h-`, `min-h-screen`, and `aspect-` on dashboard cards. Report them. Most will need to be removed.
4. Confirm the styling system (Tailwind version, or CSS modules, or styled-components) so you use the right syntax throughout.

**Stop and report Phase 0 findings before writing code.**

---

## Phase 1 — Layout tokens

Define these once and use them everywhere. No ad-hoc spacing values anywhere in the dashboard.

```
Page horizontal padding      24px
Page top padding             20px
Page bottom padding          32px
Gap between all grid cells   16px
Gap between stacked cards    16px  (same value — the rhythm must be uniform)
Card border radius           14px
Card padding                 18px
Card header → body gap       12px
Row gap inside a card body   10px
```

Type scale for card internals (do not change colors, only sizes/weights):

```
Card title (eyebrow)   11px / 600 / uppercase / letter-spacing 0.08em / muted color
Metric label           13px / 400 / muted
Metric value           13px / 500 / tabular-nums / right-aligned
Big KPI value          20px / 600 / tabular-nums
Card footer link       13px / 500 / accent
```

Every numeric value in the app must use `font-variant-numeric: tabular-nums` so columns of numbers align. Right-align all values in label/value rows using `flex justify-between items-baseline`.

---

## Phase 2 — Grid structure (the core change)

Replace the current dashboard body with **four column stacks inside one grid**. Do not place individual cards directly in the grid — place the four column wrappers.

```tsx
{/* KPI strip — separate grid, 5 equal cells */}
<div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
  {/* 5 KPI cards, each min-h-[76px] */}
</div>

{/* Main dashboard — 4 column stacks */}
<div className="mt-4 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4 items-stretch">
  <div className="flex h-full min-h-0 flex-col gap-4">{/* COLUMN 1 */}</div>
  <div className="flex h-full min-h-0 flex-col gap-4">{/* COLUMN 2 */}</div>
  <div className="flex h-full min-h-0 flex-col gap-4">{/* COLUMN 3 */}</div>
  <div className="flex h-full min-h-0 flex-col gap-4">{/* COLUMN 4 */}</div>
</div>

{/* Habit history — full width */}
<div className="mt-4">{/* habit history card */}</div>
```

Critical details, all of which are load-bearing:

- `items-stretch` on the grid (this is the default — do **not** override it with `items-start`, which is very likely what is currently there and causing the ragged bottoms).
- `h-full` on each column stack so it fills the stretched grid cell.
- `min-h-0` on the column stack and on any card that contains a scrollable or chart child, otherwise flex children refuse to shrink and overflow instead.
- The four column wrappers are the only direct children of the grid.

---

## Phase 3 — Exact card placement

Move the cards into these columns, in this order, top to bottom. This distribution is balanced by measured natural height so no single column is dramatically taller than the others before stretching.

**Column 1**
1. `GOALS` — **`flex-1`, this is the filler for column 1**
2. `RECENT NOTES` — natural height, `min-h-[240px]`

**Column 2**
1. `OVERALL PROGRESS` — natural height, `min-h-[200px]`
2. `TODAY'S ROUTINE` — **`flex-1`, filler for column 2**
3. `FINANCE` — natural height, `min-h-[190px]`

**Column 3**
1. `LIFE SCORE` — fixed `h-[168px]`
2. `AI MENTOR INSIGHT` — natural height, `min-h-[120px]`
3. `BUSINESS` — natural height, `min-h-[140px]`
4. `HEALTH` — **`flex-1`, filler for column 3**, `min-h-[190px]`

**Column 4**
1. `PRIORITY TASKS` — natural height, `min-h-[170px]`
2. `UPCOMING` — natural height, `min-h-[210px]`
3. `RECENT ACTIVITY` — **`flex-1`, filler for column 4**, `min-h-[100px]`

Note: `RECENT NOTES` currently sits in its own narrow fifth column on the far right, and `GOALS` in its own narrow first column. Both narrow columns are eliminated — that alone recovers the two worst dead-space regions in the screenshot.

Every card component must be:

```tsx
<section className="flex flex-col rounded-[14px] border border-white/5 bg-[card-bg] p-[18px]">
  <header className="mb-3 flex items-center justify-between">…</header>
  <div className="flex min-h-0 flex-1 flex-col">…body…</div>
</section>
```

The body wrapper with `flex-1` is required so that when the card itself is stretched, the *content* fills it rather than pooling at the top with a void underneath.

---

## Phase 4 — What each filler card does with its extra space

A filler card must not just grow with empty space inside it. Each one needs a defined fill behavior:

- **GOALS** — render all goals, not a truncated set. The list gets `flex-1 overflow-y-auto` with `scrollbar-width: none`. The "All Goals →" link is pinned to the bottom with `mt-auto pt-3`. Each goal row: title on one line with `truncate`, progress bar `h-1 rounded-full` directly under it, percentage right-aligned on the same baseline as the title (currently it sits below the bar, wasting a row per goal — move it up).
- **TODAY'S ROUTINE** — remove the "+5 more" affordance and render all 9 habits. The list is `flex-1 overflow-y-auto`. The `0/9` ring stays fixed at 56px on the left, the habit list occupies the remaining width. Currently the ring is vertically centered against a 4-item list, which reads as unintentional — align the ring to the top instead (`items-start`).
- **HEALTH** — after the existing metric rows, add `mt-auto` to the "Health →" footer link so it pins to the bottom of the stretched card rather than floating mid-card.
- **RECENT ACTIVITY** — this is an empty state. Center its message both axes: `flex-1 flex items-center justify-center text-center`. Constrain the message to `max-w-[280px]` and rewrite it as one line: "Nothing logged yet." with a secondary line "Activity from every module shows up here." An empty state that fills its container intentionally does not read as dead space; the same empty state top-aligned in a tall box does.

---

## Phase 5 — Per-card internal defects visible in the current build

Fix each of these specifically:

1. **OVERALL PROGRESS — chart axis is clipped.** The Y-axis tick labels are being cut off at the left edge (partial glyphs are rendering). Set the chart container to `h-[132px] w-full` with `<ResponsiveContainer width="100%" height="100%">` and give the chart `margin={{ top: 4, right: 8, bottom: 0, left: 0 }}` with `<YAxis width={36} tick={{ fontSize: 10 }} tickFormatter={compact} axisLine={false} tickLine={false} />`. Never set a pixel width on ResponsiveContainer. Move the date range labels (`2026-06-30` / `2026-07-29`) into the X-axis as first/last ticks rather than a separate row of text below the chart — that separate row is costing 20px for no information gain.
2. **LIFE SCORE — the donut is undersized and orbited by empty space.** Set the ring to exactly 96px diameter with 10px stroke, `stroke-linecap: round`. Layout the card as `flex items-center gap-4`: ring on the left at fixed 96px, legend on the right as `flex-1` with five `justify-between` rows at 12px. Card height fixed at 168px. This removes roughly 40px of internal void.
3. **PRIORITY TASKS — titles truncate mid-word** ("Solve minor-contract problem: p…"). With the wider column this mostly resolves, but also: move the date to a second line at 11px muted instead of competing for horizontal space on the same line, and set the title to `line-clamp-2`. The `HIGH` badge becomes a 6px dot with a `sr-only` label — the pill badge is eating ~46px of horizontal space per row.
4. **UPCOMING** — same two-line treatment. Remove the `>` chevron on each row and make the entire row a hover target instead; the chevrons add a column of width for zero information.
5. **HABIT HISTORY** — the 12-week grid must fill the full container width. Use `grid grid-cols-[120px_1fr]` with the cell strip as `grid grid-flow-col auto-cols-fr gap-[3px]`, cells `h-[10px] rounded-[2px]`. Card height ~132px. Right-align the "Routine →" link in the header, which it already is — keep it.
6. **SIDEBAR — there is an overlap bug at the bottom left.** The circular "N" avatar is rendering on top of the "Collapse" label. Make the sidebar `flex h-screen flex-col`, nav `flex-1 overflow-y-auto`, footer block `mt-auto shrink-0` containing workspace row and collapse button as separate stacked rows with `gap-2`. No absolute positioning in the sidebar footer.
7. **KPI strip** — each card `min-h-[76px] p-4`, icon 32px, label 11px uppercase muted, value 20px semibold tabular-nums. Currently these are fine; just normalize to the token values.

---

## Phase 6 — Responsive

The four column stacks give you responsive behavior for free:

- `≥1536px` (2xl): 4 columns
- `768–1535px`: 2 columns, each grid cell holding one full column stack (columns 1+2 top row, 3+4 bottom row) — `items-stretch` still equalizes each row
- `<768px`: 1 column, stacks in order 1→2→3→4

The KPI strip: 5 → 3 → 2 across the same breakpoints. Habit history: horizontally scrollable below 768px with `overflow-x-auto` and the label column `sticky left-0`.

Do not introduce any other breakpoints.

---

## Phase 7 — Verification (do not skip; this is how I'll know it worked)

Run the dev server and check at viewport widths **1280, 1440, 1920, and 2560**. If Playwright or a headless browser is available, script this and take screenshots. Then verify each of these programmatically or by measurement:

1. The four column stacks have **bottom edges within 2px of each other** at every breakpoint. Measure with `getBoundingClientRect().bottom`. This is the single most important check.
2. No card has more than 24px of empty space between its last content element and its bottom padding edge.
3. No horizontal scrollbar at any breakpoint.
4. No text is clipped or truncated mid-word except where `truncate`/`line-clamp-2` is deliberately applied.
5. The chart's Y-axis labels are fully visible, not cut off.
6. Nothing in the sidebar overlaps anything else.
7. Total page scroll height at 1920×1080 should decrease relative to the current build — report the before and after numbers.

---

## Constraints

- **Do not change any colors, fonts, icons, or copy** except the Recent Activity empty-state text specified above. This is a layout pass only.
- **Do not add new dependencies.** No masonry library, no grid library.
- **Do not use absolute positioning** to solve any of this.
- **Do not set explicit pixel heights** on cards other than `LIFE SCORE` (168px) and the chart container (132px). Everything else is `min-h-*` or `flex-1`.
- Do not touch data fetching, state, or routing.

## Output

When done, give me: (1) the list of files changed, (2) the measured column-bottom deltas at all four breakpoints, (3) before/after page scroll height, (4) anything in this spec you deviated from and why.
