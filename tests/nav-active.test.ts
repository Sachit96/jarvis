import { test } from "node:test";
import assert from "node:assert/strict";
import { activeNavHref, crumbHref, type NavTarget } from "../lib/nav-active";

// The real tables live in lib/nav-items.ts, which imports lucide-react and
// therefore cannot be loaded here. Mirrored as plain hrefs instead — the
// route shapes are the thing under test, and the guard below fails if the
// two ever drift.
const SIDEBAR_ITEMS: NavTarget[] = [
  { href: "/" },
  { href: "/business/dashboard" },
  { href: "/health/workouts" },
  { href: "/finance/overview" },
  { href: "/life/goals" },
  { href: "/life/tasks", matches: ["/life/habits", "/life/journal"] },
  { href: "/mentor" },
  { href: "/voice" },
  { href: "/memory" },
  { href: "/settings" },
];

const NAV_ITEMS: NavTarget[] = [
  { href: "/" },
  { href: "/business/dashboard" },
  { href: "/finance/overview" },
  { href: "/health/workouts" },
  { href: "/life/goals" },
];

test("the mirrored tables match lib/nav-items.ts", async () => {
  // Reads the source rather than importing it, so a change to the real nav
  // that this file has not kept up with fails here instead of silently
  // testing a stale copy.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../lib/nav-items.ts", import.meta.url), "utf8");
  const declared = source.slice(source.indexOf("SIDEBAR_ITEMS"), source.indexOf("export interface NavGroup"));
  for (const item of SIDEBAR_ITEMS) {
    assert.ok(declared.includes(`href: "${item.href}"`), `nav-items.ts no longer has ${item.href}`);
  }
  const hrefCount = [...declared.matchAll(/href: "/g)].length;
  assert.equal(hrefCount, SIDEBAR_ITEMS.length, "SIDEBAR_ITEMS gained or lost an entry");

  // NAV_ITEMS was NOT checked here, and drifted: the mobile bar lost
  // University and gained Goals while this file's copy kept asserting that
  // /life/goals lights nothing. A stale mirror that still passes is worse
  // than no mirror.
  const mobile = source.slice(source.indexOf("export const NAV_ITEMS"), source.indexOf("export interface ModuleTab"));
  for (const item of NAV_ITEMS) {
    assert.ok(mobile.includes(`href: "${item.href}"`), `nav-items.ts no longer has ${item.href} in NAV_ITEMS`);
  }
  assert.equal(
    [...mobile.matchAll(/href: "/g)].length,
    NAV_ITEMS.length,
    "NAV_ITEMS gained or lost an entry",
  );
});

test("exactly one sidebar item is ever active", () => {
  const routes = [
    "/",
    "/business/dashboard",
    "/business/pipeline",
    "/business/clients/abc",
    "/finance/overview",
    "/finance/budgets",
    "/health/workouts",
    "/health/nutrition",
    "/life/goals",
    "/life/tasks",
    "/life/habits",
    "/life/journal",
    "/mentor",
    "/mentor/weekly-review",
    "/voice",
    "/memory",
    "/settings",
  ];
  for (const route of routes) {
    const matches = SIDEBAR_ITEMS.filter((item) => activeNavHref(route, SIDEBAR_ITEMS) === item.href);
    assert.equal(matches.length, 1, `${route} should light exactly one nav item, got ${matches.length}`);
  }
});

test("the two /life destinations do not both claim /life/goals", () => {
  // The regression this guards: both "Goals" (/life/goals) and "Tasks &
  // Routine" (/life/tasks) match on the first path segment, so a
  // segment-only rule lit both rows at once.
  assert.equal(activeNavHref("/life/goals", SIDEBAR_ITEMS), "/life/goals");
  assert.equal(activeNavHref("/life/tasks", SIDEBAR_ITEMS), "/life/tasks");
});

test("Tasks & Routine owns its own tab routes", () => {
  assert.equal(activeNavHref("/life/habits", SIDEBAR_ITEMS), "/life/tasks");
  assert.equal(activeNavHref("/life/journal", SIDEBAR_ITEMS), "/life/tasks");
});

test("a module's deeper routes light its top-level entry", () => {
  assert.equal(activeNavHref("/finance/budgets", SIDEBAR_ITEMS), "/finance/overview");
  assert.equal(activeNavHref("/health/nutrition", SIDEBAR_ITEMS), "/health/workouts");
  assert.equal(activeNavHref("/business/pipeline", SIDEBAR_ITEMS), "/business/dashboard");
});

test("Home is active only at the root", () => {
  assert.equal(activeNavHref("/", SIDEBAR_ITEMS), "/");
  assert.notEqual(activeNavHref("/settings", SIDEBAR_ITEMS), "/");
});

test("an unknown route lights nothing rather than guessing", () => {
  assert.equal(activeNavHref("/nowhere", SIDEBAR_ITEMS), null);
});

test("the mobile bar resolves against its own shorter list", () => {
  // The bar carries five of the sidebar's entries. A route under one of
  // them lights it; a route under an entry the bar does not carry lights
  // nothing, rather than falling through to an unrelated tab.
  assert.equal(activeNavHref("/life/goals", NAV_ITEMS), "/life/goals");
  assert.equal(activeNavHref("/health/body", NAV_ITEMS), "/health/workouts");
  assert.equal(activeNavHref("/memory", NAV_ITEMS), null);
});

test("breadcrumb crumb destinations", async (t) => {
  const items = [
    { href: "/" },
    { href: "/business/dashboard" },
    { href: "/finance/overview" },
    { href: "/memory" },
    { href: "/settings" },
  ];

  await t.test("a real route links to itself", () => {
    assert.equal(crumbHref("/memory", items), "/memory");
    assert.equal(crumbHref("/settings", items), "/settings");
  });

  await t.test("a module segment resolves to its landing route", () => {
    // /business is not a route; linking it 404s.
    assert.equal(crumbHref("/business", items), "/business/dashboard");
    assert.equal(crumbHref("/finance", items), "/finance/overview");
  });

  await t.test("a segment nothing lives under is not a link", () => {
    assert.equal(crumbHref("/nowhere", items), null);
  });

  await t.test("a prefix match must be a path boundary", () => {
    // "/busine" must not capture "/business/dashboard".
    assert.equal(crumbHref("/busine", items), null);
  });
});
