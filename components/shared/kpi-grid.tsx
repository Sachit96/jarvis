import type { ComponentProps, ReactNode } from "react";
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
    <div
      className={cn("overflow-hidden rounded-2xl bg-card ring-1 ring-border", className)}
      {...props}
    >
      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2",
          columns === 2 && "xl:grid-cols-2",
          columns === 3 && "xl:grid-cols-3",
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
   * Category tint for the label's leading dot. Omit for a figure that isn't
   * about one domain — the dot is identity, so an arbitrary color would be
   * claiming an identity that isn't there.
   */
  accentClassName?: string;
  className?: string;
}

/**
 * One cell of a KpiGrid. Cells carry their own right/bottom hairline and
 * rely on the parent's `overflow-hidden` to clip the ones that fall on the
 * block's outer edge — that way a cell never needs to know whether it is
 * last in its row, which changes with the breakpoint anyway.
 */
export function KpiCell({ label, value, hint, action, accentClassName, className }: KpiCellProps) {
  return (
    <div className={cn("flex flex-col gap-3 border-border border-r border-b p-5", className)}>
      <div className="flex items-center gap-2">
        {accentClassName ? (
          <span className={cn("size-1.5 shrink-0 rounded-full bg-current", accentClassName)} />
        ) : null}
        <p className="text-body text-muted-foreground">{label}</p>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="tabular truncate text-metric">{value}</div>
          {hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null}
        </div>
        {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
      </div>
    </div>
  );
}
