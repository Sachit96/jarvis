/**
 * Which nav item a route belongs to.
 *
 * Deliberately in its own module with no icon imports. `lib/nav-items.ts`
 * pulls in lucide-react, which needs React and therefore cannot be loaded by
 * the test runner (it runs under --conditions=react-server) — so routing
 * logic living next to the icon table was logic that could not be tested.
 */

/** The shape this needs from a nav item; the real NavItem satisfies it. */
export interface NavTarget {
  href: string;
  /**
   * Extra routes this item owns, for modules whose pages do not all live
   * under its own href.
   *
   * "Tasks & Routine" is the only one today: its href is /life/tasks but it
   * also owns /life/habits and /life/journal (its own tab row), while
   * /life/goals belongs to a different nav item entirely.
   */
  matches?: string[];
}

/** True when `pathname` is `base` or something nested underneath it. */
function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * The old rule was "the first path segment matches", which is right for
 * eleven of the twelve destinations and wrong for the two that share /life:
 * on /life/goals BOTH "Goals" and "Tasks & Routine" reported themselves
 * active, so the sidebar lit two modules at once. Invisible while the active
 * state was a faint grey pill; obvious the moment it became a gradient
 * indicator, and only ever visible in a rendered page.
 *
 * Resolution order: an explicit href/`matches` prefix wins (longest first,
 * so a more specific item beats a more general one), and only if nothing
 * claims the route does it fall back to the module segment — and then only
 * when exactly one item lays claim to that segment. Returns null rather than
 * guessing, so a route no item owns lights nothing.
 */
export function activeNavHref<T extends NavTarget>(pathname: string, items: T[]): string | null {
  let best: { href: string; length: number } | null = null;
  for (const item of items) {
    if (item.href === "/") {
      if (pathname === "/") return "/";
      continue;
    }
    for (const base of [item.href, ...(item.matches ?? [])]) {
      if (isUnder(pathname, base) && (best === null || base.length > best.length)) {
        best = { href: item.href, length: base.length };
      }
    }
  }
  if (best) return best.href;

  const segment = `/${pathname.split("/")[1] ?? ""}`;
  const owners = items.filter((item) => item.href !== "/" && `/${item.href.split("/")[1]}` === segment);
  return owners.length === 1 ? owners[0].href : null;
}

/**
 * Where a breadcrumb crumb should actually link.
 *
 * A trail built straight from path segments points its module crumb at
 * `/business`, `/finance`, `/health`, `/life` — and none of those are
 * routes. Every sub-page in four modules shipped a breadcrumb whose second
 * link 404s, and Next prefetched it on hover, so the failure showed up in
 * the console before anyone clicked.
 *
 * A module crumb resolves to that module's landing route instead
 * (/business → /business/dashboard). When nothing in the nav lives under
 * the segment there is no honest destination, so this returns null and the
 * caller renders plain text: a breadcrumb that goes nowhere is worse than
 * one that is not a link.
 */
export function crumbHref<T extends NavTarget>(href: string, items: T[]): string | null {
  if (items.some((item) => item.href === href)) return href;
  const landing = items.find((item) => item.href.startsWith(`${href}/`));
  return landing?.href ?? null;
}
