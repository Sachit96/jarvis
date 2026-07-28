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
}

/**
 * The one card shape used everywhere — elevation over hard borders. A
 * near-black background already reads poorly with drop shadows, so depth
 * comes from a translucent-white fill (--card) plus a barely-there hairline
 * ring (--border), not a directional border.
 */
export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-2xl bg-card p-6 ring-1 ring-border",
        interactive &&
          "press cursor-pointer transition-[background-color,box-shadow] duration-200 ease-[var(--ease-jarvis)] hover:bg-[color-mix(in_oklch,var(--card),white_4%)] hover:ring-white/[0.14]",
        className,
      )}
      {...props}
    />
  );
}
