import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The module header every page opens with: eyebrow, title, optional
 * subtitle, and the page's actions on the right.
 *
 * Consolidated because thirty pages had each written their own version of
 * `<p className="text-label uppercase tracking-wide …">` above an `<h1>`,
 * with the spacing and the eyebrow's tracking drifting a little each time.
 * Thirty near-identical headers is one of the specific ways an app stops
 * looking like one product.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  /** The module this page belongs to — "Health", "Finance". Uppercase micro-label. */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        {/* text-display, not text-title: the page's name is the one large
            moment above the fold, and at the old 22px it was competing with
            card titles instead of ranking above them. */}
        <h1 className="truncate text-display">{title}</h1>
        {description ? <p className="text-body text-foreground-tertiary">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * A labelled region *inside* a card or below a page header. Same eyebrow
 * language as PageHeader so a section reads as a step down from the page
 * without inventing a second type scale.
 */
export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <p className="eyebrow">{title}</p>
        {description ? <p className="mt-1 text-caption text-foreground-tertiary">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
