"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SIDEBAR_ITEMS } from "@/lib/nav-items";

/**
 * The floating glass capsule.
 *
 * Replaces the full-width admin header on desktop with a control surface that
 * hovers over the canvas — §6 is explicit that it must not read as a
 * conventional navbar, and a bordered bar pinned edge-to-edge is exactly that
 * however much blur it has.
 *
 * Desktop only (lg+). The sidebar already handles md, and the mobile bottom
 * bar already handles thumbs; a third navigation on a phone would be clutter
 * competing with both.
 *
 * Icon-only with a label on hover, because twelve destinations with visible
 * labels is a bar, not a capsule.
 */
export function FloatingNav() {
  const pathname = usePathname();
  const scrolled = useScrolled(12);

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-4 z-40 hidden justify-center lg:flex",
      )}
    >
      <ul
        className={cn(
          "pointer-events-auto flex items-center gap-0.5 rounded-full border p-1.5 transition-all duration-300",
          // Past the fold the capsule needs to hold its own against content
          // scrolling beneath it, so the surface and edge firm up slightly.
          // Before that it can afford to almost disappear.
          scrolled
            ? "border-white/[0.14] bg-white/[0.06] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
            : "border-white/[0.08] bg-white/[0.03] backdrop-blur-xl",
        )}
      >
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(`/${item.href.split("/")[1]}`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={cn(
                  "group relative flex size-9 items-center justify-center rounded-full transition-colors",
                  active
                    ? "text-white"
                    : "text-foreground-tertiary hover:bg-white/[0.06] hover:text-white",
                )}
              >
                {/* The gradient lives on its own layer so the icon stays pure
                    white on top of it rather than inheriting a tint. */}
                {active ? (
                  <span
                    aria-hidden
                    className="gradient-brand absolute inset-0 rounded-full opacity-90 shadow-[0_0_24px_-4px_var(--brand)]"
                  />
                ) : null}
                <Icon className="relative size-4" strokeWidth={2} />
                <span className="sr-only">{item.label}</span>
                {/* Label on hover: keeps the capsule compact without making
                    twelve icons a memory test. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-full border border-border bg-popover px-2 py-1 text-caption opacity-0 transition-opacity group-hover:opacity-100"
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** True once the page has scrolled past `threshold` px. */
function useScrolled(threshold: number): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    // passive: this must never delay a scroll frame.
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}
