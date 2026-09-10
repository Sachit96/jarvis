"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The floating command bar's surface.
 *
 * This is the resolution of the two-navigation problem. There was a
 * `FloatingNav` capsule built to replace this header, which would have put
 * a second set of twelve destinations on screen at the same time as the
 * sidebar — the exact "two competing navigation systems" outcome. So the
 * hierarchy is settled the other way round:
 *
 *   sidebar  → destinations (the only place you change module)
 *   this bar → context and commands for the module you are in
 *   bottom bar → the same destinations, for thumbs, under md
 *
 * What survives from the capsule is its *treatment*, not its content: this
 * is a rounded glass surface hovering over the canvas rather than a
 * full-bleed bordered header, so the shell reads as a control surface
 * instead of an admin chrome bar. `FloatingNav` itself is gone — keeping an
 * unmounted second navigation around is the same problem, just latent.
 */
export function TopbarSurface({ children }: { children: ReactNode }) {
  const scrolled = useScrolled(8);

  return (
    <div className="sticky top-0 z-30 px-3 pt-3 pb-1 md:px-4">
      <header
        className={cn(
          "flex h-12 items-center gap-2 rounded-full px-2 transition-[background-color,box-shadow] duration-300 ease-[var(--ease-jarvis)] md:px-3",
          // Over the fold the bar can almost disappear; past it, content is
          // sliding underneath and the surface has to hold its own edge.
          scrolled
            ? "bg-white/[0.055] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.09),0_0_0_1px_rgb(255_255_255/0.1),0_8px_32px_-12px_rgb(0_0_0/0.9)] backdrop-blur-xl"
            : "bg-white/[0.03] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05),0_0_0_1px_var(--border)] backdrop-blur-md",
        )}
      >
        {children}
      </header>
    </div>
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
