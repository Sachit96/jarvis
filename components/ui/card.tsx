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
  /**
   * How the card pads its own children.
   *
   * "default"/"compact" are the original self-padding modes — the card
   * applies one uniform pad and the caller drops arbitrary children in.
   * Every card written before the redesign uses these, so they keep their
   * exact previous output.
   *
   * "slotted" hands padding off to the CardHeader/CardContent/CardFooter
   * children below, which pad horizontally by `--card-spacing` while the
   * card itself pads vertically. That's what makes a header rule or a
   * footer bar able to span the full card width — the thing the
   * self-padding modes structurally can't do — so it's the mode new
   * dashboard work should reach for.
   */
  padding?: "default" | "compact" | "slotted";
  /**
   * Where this card sits in the depth ladder (see `.surface*` in
   * app/globals.css).
   *
   * "default" is level 2 — the working surface, and what almost every card
   * should be. "raised" is level 3, for the one or two panels per page that
   * carry the page's actual answer. "lit" is level 3 with brand light pooled
   * behind it and is reserved for the single most important panel on a
   * screen; a page with three lit cards has none.
   */
  elevation?: "default" | "raised" | "lit";
}

/**
 * The one card shape used everywhere.
 *
 * Depth is a translucent fill over pure black, blurred, with a lit top edge
 * and a barely-there hairline — never a directional border and never a
 * drop shadow on its own, which on a near-black canvas just smudges.
 *
 * The radius is `--radius` (16px) rather than the old `rounded-2xl`, which
 * resolved through the radius scale to 28.8px — soft enough that cards read
 * as pills rather than panels. Caught in the browser: the token said 1rem
 * and the rendered corner was 28.8px.
 */
export function Card({
  className,
  interactive,
  padding = "default",
  elevation = "default",
  ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      data-elevation={elevation}
      className={cn(
        // The surface classes carry fill, blur, radius, the lit top edge and
        // the hairline together — a card cannot end up with the fill but not
        // the blur, which is precisely how the previous version drifted into
        // looking like a flat panel.
        elevation === "lit" ? "surface-lit" : elevation === "raised" ? "surface-raised" : "surface",
        // Compact cards (dashboard-only) are always a flex column so a card can host a
        // flex-1 body that either scrolls or pins a footer to the bottom via mt-auto —
        // required for the column-stretch layout on Home. overflow-hidden is the safety
        // net: without it, a filler card whose content ever exceeds its stretched height
        // spills past the card's rounded corners instead of being caught by the child's
        // own overflow-y-auto. Default (non-dashboard) cards are untouched.
        padding === "compact" && "flex flex-col overflow-hidden p-[18px]",
        padding === "default" && "p-6",
        // Slotted cards own only the vertical rhythm; --card-spacing is the
        // single knob every slot below reads, so a caller can tighten a whole
        // card with one `[--card-spacing:--spacing(3)]` instead of re-padding
        // each slot. overflow-hidden lets a full-bleed child (a chart, an
        // image, a divided sub-grid) reach the card's rounded edge cleanly.
        padding === "slotted" &&
          "flex flex-col gap-(--card-spacing) overflow-hidden py-(--card-spacing) [--card-spacing:--spacing(5)]",
        interactive && "surface-interactive cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Header row of a slotted card. Lays out as a grid rather than a flex row so
 * a CardAction can sit in a second column spanning both the title and
 * description rows — a flex row would push the action off the title's
 * baseline as soon as a description wraps to two lines.
 */
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min items-start gap-1 px-(--card-spacing)",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        // A header that opts into a bottom rule needs the rule to sit a full
        // --card-spacing below the text, not flush against it.
        "[.border-b]:pb-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Card titles are deliberately `text-heading` (the app's section-label step)
 * and not a heading element — a card title is a label for a region, and the
 * page's real h1 lives in the module header above the grid. Callers that
 * need semantics can pass `render`-style props through to a heading tag.
 */
export function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("text-heading", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="card-description" className={cn("text-body text-muted-foreground", className)} {...props} />
  );
}

/** Trailing control in a card header — a Select, a filter, an overflow menu. */
export function CardAction({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />;
}

/**
 * Footers are visually a separate bar, so they cancel the card's bottom
 * padding and pay for their own — hence the negative bottom margin rather
 * than a conditional on Card itself.
 */
export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "-mb-(--card-spacing) mt-auto flex items-center border-t border-border bg-white/[0.02] p-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}
