import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends ComponentProps<"div"> {
  /** Cards that respond to hover/press because they navigate or open something. */
  interactive?: boolean;
}

/**
 * The one card shape used everywhere — elevation over hard borders. A
 * near-black background already reads poorly with drop shadows, so depth
 * comes from a barely-there full ring (not a directional border) plus the
 * card surface sitting one step lighter than the page behind it.
 */
export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-2xl bg-card p-5 ring-1 ring-white/[0.06]",
        interactive &&
          "press cursor-pointer transition-[background-color,box-shadow] duration-200 ease-[var(--ease-jarvis)] hover:bg-[color-mix(in_oklch,var(--card),white_3%)] hover:ring-white/[0.1]",
        className,
      )}
      {...props}
    />
  );
}
