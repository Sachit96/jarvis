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
  /** Mark at most one tile per screen — the accent ring is reserved for it. */
  primary?: boolean;
  className?: string;
}

const TONE_TEXT: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "text-muted-foreground",
  success: "text-success",
  danger: "text-danger",
  warn: "text-warn",
};

const TONE_CHIP: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/15 text-success",
  danger: "bg-danger/15 text-danger",
  warn: "bg-warn/15 text-warn",
};

export function StatTile({
  label,
  value,
  delta,
  tone = "neutral",
  trend,
  primary = false,
  className,
}: StatTileProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;

  return (
    <Card className={cn(primary && "ring-brand/40", className)}>
      <p className="text-label uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 font-mono text-title", primary ? "text-brand" : "text-foreground")}>{value}</p>
      {delta ? (
        TrendIcon ? (
          <span
            className={cn(
              "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium",
              TONE_CHIP[tone],
            )}
          >
            <TrendIcon className="h-3 w-3" strokeWidth={2.5} />
            {delta}
          </span>
        ) : (
          <p className={cn("mt-1 text-caption font-mono", TONE_TEXT[tone])}>{delta}</p>
        )
      ) : null}
    </Card>
  );
}
