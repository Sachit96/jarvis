import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeltaBadgeProps {
  /** Period-over-period change, as a percentage. 8.4 renders "+8.4%". */
  percent: number;
  /**
   * Which direction is good. Spending and body fat go down to improve, so
   * they pass "down" and get green on a negative delta — without this the
   * badge would congratulate the user for spending more.
   */
  goodDirection?: "up" | "down";
  /**
   * Set for a figure where neither direction is good or bad (headcount,
   * session length). Renders neutral, so color is never claiming a judgement
   * the metric doesn't support.
   */
  neutral?: boolean;
  className?: string;
}

/**
 * The trailing chip on a KPI cell.
 *
 * Color here is a status signal, not decoration, so it stays out of the
 * categorical palette entirely (--success/--danger, never --cat-*) and is
 * never the only cue: the arrow icon and the signed number both carry the
 * same information for anyone who can't separate the two hues.
 */
export function DeltaBadge({ percent, goodDirection = "up", neutral, className }: DeltaBadgeProps) {
  const rounded = Math.round(percent * 10) / 10;
  const rising = rounded > 0;
  // Exactly zero is neither good nor bad; treating it as "good" would paint
  // a flat month green.
  const isGood = rounded === 0 ? null : (goodDirection === "up") === rising;
  const Icon = rising ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "tabular inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full px-2 text-label font-medium",
        neutral || isGood === null
          ? "bg-white/[0.06] text-muted-foreground"
          : isGood
            ? "bg-success/12 text-success"
            : "bg-danger/12 text-danger",
        className,
      )}
    >
      {rounded === 0 ? null : <Icon className="size-3" strokeWidth={2.25} aria-hidden />}
      {rounded > 0 ? "+" : ""}
      {rounded}%
    </span>
  );
}
