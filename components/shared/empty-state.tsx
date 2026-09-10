import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  /**
   * The figure the absence is *about* — "$0", "0 / 8". Rendered above the
   * title at metric scale.
   *
   * §18: a real zero is a measurement, not a fault. Showing it plainly,
   * with the explanation directly under it, is what makes an empty panel
   * read as intentional rather than broken — the alternative everyone
   * reaches for is inventing activity to fill the space.
   */
  value?: ReactNode;
  /**
   * Trims the padding for an empty state living inside a dashboard card
   * rather than standing in for a whole page. Same anatomy, less air —
   * a full-page empty state's whitespace inside a 200px card just pushes
   * the copy off the bottom.
   */
  compact?: boolean;
  className?: string;
}

/**
 * The considered version of "no data yet".
 *
 * Generous whitespace instead of a dashed placeholder box, copy that sounds
 * written rather than defaulted to, and exactly one brand accent: a small
 * ringed icon that echoes the radar motif. Keep titles short and specific to
 * the thing that is missing ("No trades logged yet" beats "No data").
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  value,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden
          className={cn(
            "relative flex items-center justify-center rounded-full bg-white/[0.03] text-foreground-tertiary",
            "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06),0_0_0_1px_var(--border)]",
            compact ? "size-9" : "size-11",
          )}
        >
          {/* The one accent: a brand-tinted ring, echoing the radar rings
              without drawing a whole radar into every empty panel. */}
          <span className="absolute inset-[-5px] rounded-full border border-[color-mix(in_oklab,var(--brand)_28%,transparent)]" />
          <Icon className={compact ? "size-4" : "size-[18px]"} strokeWidth={1.5} />
        </span>
      ) : null}

      {value !== undefined ? (
        <p className="tabular font-display text-metric text-foreground-tertiary">{value}</p>
      ) : null}

      <div className="space-y-1.5">
        {/* Uppercase micro-label, per §18's own example ("$0 / NO ACCOUNTS
            CONNECTED / Connect a financial account…"). Keep titles to a
            short phrase — a full sentence at 11px with 0.2em tracking is
            unreadable, and the sentence belongs in `description`. */}
        <p className="eyebrow">{title}</p>
        {description ? (
          <p className="mx-auto max-w-[36ch] text-body text-foreground-tertiary">{description}</p>
        ) : null}
      </div>

      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
