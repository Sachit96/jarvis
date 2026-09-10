"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { activeNavHref, SIDEBAR_ITEMS } from "@/lib/nav-items";

/**
 * Titles a segment the way the nav does wherever possible, so the trail and
 * the sidebar agree ("uni" reads as "University", not "Uni"). Falls back to
 * de-slugged title case for leaf segments the nav has no entry for.
 *
 * `fullPath` matters, not just the crumb's own href: naming a module segment
 * meant finding the first nav item starting with it, so on /life/tasks the
 * trail opened with "Goals" — the first /life entry in the list — while the
 * sidebar correctly highlighted Tasks & Routine. Resolving through the same
 * function the sidebar uses means the two cannot disagree again.
 */
function labelFor(segment: string, href: string, fullPath: string) {
  const navMatch = SIDEBAR_ITEMS.find((item) => item.href === href);
  if (navMatch) return navMatch.label;

  if (href === `/${segment}`) {
    const owner = activeNavHref(fullPath, SIDEBAR_ITEMS);
    const item = owner ? SIDEBAR_ITEMS.find((i) => i.href === owner) : undefined;
    if (item && `/${item.href.split("/")[1]}` === href) return item.label;
  }

  return segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Route-derived trail. Deliberately not configurable per page: a trail that
 * pages hand-write drifts out of sync with the routes it claims to describe,
 * and this app's URLs already mirror its information architecture.
 *
 * Record ids (/uni/courses/<uuid>) are the one thing worth suppressing —
 * a raw uuid in a breadcrumb is noise, and the page's own <h1> names the
 * record properly.
 */
const ID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const crumbs = segments
    .map((segment, index) => ({
      segment,
      href: `/${segments.slice(0, index + 1).join("/")}`,
    }))
    .filter((crumb) => !ID_LIKE.test(crumb.segment))
    .map((crumb) => ({ ...crumb, label: labelFor(crumb.segment, crumb.href, pathname) }))
    // Consecutive crumbs that resolve to the same words are one crumb.
    // /life/goals titled both segments "Goals" (the module lookup finds
    // "Goals" for /life, and the leaf is literally "goals"), so the trail
    // read "Home › Goals › Goals". A repeated word in a breadcrumb reads as
    // a bug even when the path is perfectly sensible.
    .filter((crumb, index, all) => index === 0 || all[index - 1].label !== crumb.label);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden sm:block">
          <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
        </BreadcrumbItem>

        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
