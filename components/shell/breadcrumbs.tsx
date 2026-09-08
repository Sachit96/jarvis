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
import { SIDEBAR_ITEMS } from "@/lib/nav-items";

/**
 * Titles a segment the way the nav does wherever possible, so the trail and
 * the sidebar agree ("uni" reads as "University", not "Uni"). Falls back to
 * de-slugged title case for leaf segments the nav has no entry for.
 */
function labelFor(segment: string, href: string) {
  const navMatch = SIDEBAR_ITEMS.find((item) => item.href === href);
  if (navMatch) return navMatch.label;

  const moduleMatch = SIDEBAR_ITEMS.find((item) => item.href.startsWith(`/${segment}`));
  if (moduleMatch && `/${segment}` === `/${moduleMatch.href.split("/")[1]}`) return moduleMatch.label;

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
    .filter((crumb) => !ID_LIKE.test(crumb.segment));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden sm:block">
          <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
        </BreadcrumbItem>

        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const label = labelFor(crumb.segment, crumb.href);
          return (
            <Fragment key={crumb.href}>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>{label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
