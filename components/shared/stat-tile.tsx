import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CATEGORY_BADGE_CLASS, type Category } from "@/lib/category-colors";

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  tone?: "neutral" | "success" | "danger" | "warn";
  /** Only set this when delta is an actual directional change — renders as a trend chip instead of plain caption text. */
  trend?: "up" | "down";
  /** Mark at most one tile per screen — the accent ring is reserved for it. */
  primary?: boolean;
  /** Colored circular icon badge on the left — omit for a plain label/value tile. */
  icon?: LucideIcon;
  category?: Category;
  /** Trims padding/icon size for dense grids (e.g. the one-screen Home layout). */
  compact?: boolean;
  className?: string;
}

const TONE_TEXT: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "text-muted-foreground",
  success: "text-success",
  danger: "text-danger",
  warn: "text-warn",
};

export function StatTile({
  label,
  value,
  delta,
  tone = "neutral",
  trend,
  primary = false,
  icon: Icon,
  category = "money",
  compact = false,
  className,
}: StatTileProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;

  const body = (
    <>
      <p className={compact ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground" : "text-label uppercase tracking-wide text-muted-foreground"}>
        {label}
      </p>
      <p
        className={cn(
          "font-mono tabular-nums",
          compact ? "mt-1 text-[20px] font-semibold" : "mt-1.5 text-title",
          primary ? "text-brand" : "text-foreground",
        )}
      >
        {value}
      </p>
      {delta ? (
        <p className={cn("mt-1 inline-flex items-center gap-1 text-caption font-medium", TONE_TEXT[tone])}>
          {TrendIcon ? <TrendIcon className="h-3 w-3" strokeWidth={2.5} /> : null}
          {delta}
        </p>
      ) : null}
    </>
  );

  return (
    <Card className={cn(compact && "min-h-[76px] p-4", className)} padding={compact ? "compact" : "default"}>
      {Icon ? (
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full",
              compact ? "h-8 w-8" : "h-10 w-10",
              CATEGORY_BADGE_CLASS[category],
            )}
          >
            <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">{body}</div>
        </div>
      ) : (
        body
      )}
    </Card>
  );
}
