import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  tone?: "neutral" | "success" | "danger" | "warn";
  /** Only set this when delta is an actual directional change — renders as a trend chip instead of plain caption text. */
  trend?: "up" | "down";
  /** Mark at most one tile per screen — the brand icon chip is reserved for it. */
  primary?: boolean;
  /** Icon badge on the left — omit for a plain label/value tile. */
  icon?: LucideIcon;
  /** Trims padding/icon size for dense grids (e.g. the one-screen Home layout). */
  compact?: boolean;
  /**
   * A qualifying footnote for when `value` is a real "0"/"$0" that isn't a
   * genuine "nothing happening" measurement — e.g. "10 deals, values not
   * set yet" or "no account connected". Found live (2026-09-06 audit): a
   * bare $0 next to a real deal count reads as a broken measurement, not
   * an unset field. Renders muted, below delta, never fights it for
   * attention — this is a footnote on the headline number, not a second one.
   */
  note?: string;
  /** Dims the big number itself — pair with `note` when the value is a placeholder rather than a real reading (e.g. $0 with no accounts yet). */
  unmeasured?: boolean;
  className?: string;
}

const TONE_TEXT: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "text-foreground-tertiary",
  success: "text-success",
  danger: "text-danger",
  warn: "text-warn",
};

/**
 * A single headline figure in its own card — the freestanding sibling of
 * KpiCell, for grids that are not a fused KPI block.
 *
 * Restyled onto the same language as KpiCell so a Business page and the
 * Home command centre no longer state a number two different ways: eyebrow
 * label, display-face figure, and a monochrome icon chip.
 *
 * The `category` prop is gone. It coloured the icon badge from the domain
 * palette, which meant four tiles across the top of Business were four
 * lightly-tinted circles carrying no information the labels didn't already
 * carry. `primary` replaces it: one tile per screen gets the brand chip
 * because it is the one that matters, not because of which module it is in.
 */
export function StatTile({
  label,
  value,
  delta,
  tone = "neutral",
  trend,
  primary = false,
  icon: Icon,
  compact = false,
  className,
  note,
  unmeasured = false,
}: StatTileProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;

  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "tabular font-display",
          compact ? "mt-1.5 text-[20px] font-semibold" : "mt-2 text-metric",
          unmeasured ? "text-foreground-tertiary/60" : "text-foreground",
        )}
      >
        {value}
      </p>
      {delta ? (
        <p className={cn("mt-1.5 inline-flex items-center gap-1 text-caption font-medium", TONE_TEXT[tone])}>
          {TrendIcon ? <TrendIcon className="size-3" strokeWidth={2.5} /> : null}
          {delta}
        </p>
      ) : null}
      {note ? <p className="mt-1 text-caption text-foreground-tertiary">{note}</p> : null}
    </>
  );

  return (
    <Card className={cn(compact && "min-h-[76px] p-4", className)} padding={compact ? "compact" : "default"}>
      {Icon ? (
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg",
              compact ? "size-7" : "size-8",
              primary
                ? "bg-[color-mix(in_oklab,var(--brand)_28%,transparent)] text-white"
                : "bg-white/[0.05] text-foreground-tertiary",
            )}
          >
            <Icon className={compact ? "size-3.5" : "size-4"} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">{body}</div>
        </div>
      ) : (
        body
      )}
    </Card>
  );
}
