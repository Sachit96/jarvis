import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The fused KPI block — several headline figures sharing one card outline,
 * divided by hairlines instead of gutters.
 *
 * Why fused rather than N separate cards: these figures are read as a set
 * ("how am I doing"), and separate cards float them apart into N things to
 * evaluate one at a time. One outline with internal rules says "these
 * belong together" and, incidentally, removes N-1 ring outlines from the
 * top of the page, which is most of why a card-per-stat dashboard looks
 * busy.
 *
 * The hairlines are drawn per-cell (see KpiCell) rather than with
 * `divide-x`, because the grid reflows from 1 column to `columns` at the
 * xl breakpoint and `divide-*` has no idea where the row breaks land — it
 * would leave a stray rule hanging at the end of a wrapped row.
 */
export function KpiGrid({
  columns = 4,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { columns?: 2 | 3 | 4 }) {
  return (
    <div className={cn("surface overflow-hidden", className)} {...props}>
      <div
        className={cn(
          // Two up on a phone, not one. Stacked, four figures filled an
          // entire phone screen before any of the page's actual content
          // started — and these are meant to be read as a set.
          "grid grid-cols-2",
          columns === 2 && "xl:grid-cols-2",
          columns === 3 && "sm:grid-cols-3",
          columns === 4 && "xl:grid-cols-4",
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface KpiCellProps {
  label: string;
  /** The headline figure. Pre-formatted — this component never formats. */
  value: ReactNode;
  /** One line of context under the figure: what it's compared against. */
  hint?: ReactNode;
  /** Trailing element, normally a <DeltaBadge>. */
  action?: ReactNode;
  /**
   * The domain this figure belongs to, as its module icon.
   *
   * This replaced a coloured identity dot per cell. Four different hues
   * across the top of a dashboard is a colour chart, not a hierarchy — and
   * it was the loudest thing on the page while carrying the least
   * information. The icon says which module the number came from without
   * spending a colour on it.
   */
  icon?: LucideIcon;
  /**
   * Marks the one figure on the block that is the page's actual answer —
   * it gets the brand-tinted icon chip. At most one per block; two primary
   * cells means neither is.
   */
  primary?: boolean;
  /**
   * Tint for the figure itself — a red overdue count, say. Separate from
   * `className` so it can't be applied by putting a text colour on the cell
   * and relying on the label and hint to override it back; that works only
   * because they happen to set their own colour, and breaks silently the
   * moment one of them doesn't.
   */
  valueClassName?: string;
  className?: string;
}

/**
 * One cell of a KpiGrid. Cells carry their own right/bottom hairline and
 * rely on the parent's `overflow-hidden` to clip the ones that fall on the
 * block's outer edge — that way a cell never needs to know whether it is
 * last in its row, which changes with the breakpoint anyway.
 */
export function KpiCell({
  label,
  value,
  hint,
  action,
  icon: Icon,
  primary = false,
  valueClassName,
  className,
}: KpiCellProps) {
  return (
    <div className={cn("flex flex-col gap-3.5 border-border border-r border-b p-5", className)}>
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md",
              primary
                ? "bg-[color-mix(in_oklab,var(--brand)_28%,transparent)] text-white"
                : "bg-white/[0.05] text-foreground-tertiary",
            )}
          >
            <Icon className="size-3.5" strokeWidth={2} />
          </span>
        ) : null}
        <p className="eyebrow">{label}</p>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className={cn("tabular truncate font-display text-metric", valueClassName)}>{value}</div>
          {hint ? <p className="text-caption text-foreground-tertiary">{hint}</p> : null}
        </div>
        {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
      </div>
    </div>
  );
}
