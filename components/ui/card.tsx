import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends ComponentProps<"div"> {
  /**
   * Cards that respond to hover/press because they navigate or open
   * something. This only adds the visual affordance — if you're wrapping
   * the Card in a Link/button (the usual pattern), put
   * `focus-visible:ring-3 focus-visible:ring-ring/50 outline-none` on that
   * wrapper yourself, since it's the actual focusable element, not this div.
   */
  interactive?: boolean;
  /** "compact" trims padding for dense grids (e.g. the one-screen Home layout) — everything else stays the same. */
  padding?: "default" | "compact";
}

/**
 * The one card shape used everywhere — elevation over hard borders. A
 * near-black background already reads poorly with drop shadows, so depth
 * comes from a translucent-white fill (--card) plus a barely-there hairline
 * ring (--border), not a directional border.
 */
export function Card({ className, interactive, padding = "default", ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-2xl bg-card ring-1 ring-border",
        // Compact cards (dashboard-only) are always a flex column so a card can host a
        // flex-1 body that either scrolls or pins a footer to the bottom via mt-auto —
        // required for the column-stretch layout on Home. overflow-hidden is the safety
        // net: without it, a filler card whose content ever exceeds its stretched height
        // spills past the card's rounded corners instead of being caught by the child's
        // own overflow-y-auto. Default (non-dashboard) cards are untouched.
        padding === "compact" ? "flex flex-col overflow-hidden p-[18px]" : "p-6",
        interactive &&
          "press cursor-pointer transition-[background-color,box-shadow] duration-200 ease-[var(--ease-jarvis)] hover:bg-[color-mix(in_oklch,var(--card),white_4%)] hover:ring-white/[0.14]",
        className,
      )}
      {...props}
    />
  );
}
