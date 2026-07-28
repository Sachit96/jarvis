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
    <Card className={className}>
      <p className="text-label uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 font-mono text-title font-bold", primary ? "text-brand" : "text-foreground")}>{value}</p>
      {delta ? (
        <p className={cn("mt-1.5 inline-flex items-center gap-1 text-caption font-medium", TONE_TEXT[tone])}>
          {TrendIcon ? <TrendIcon className="h-3 w-3" strokeWidth={2.5} /> : null}
          {delta}
        </p>
      ) : null}
    </Card>
  );
}
