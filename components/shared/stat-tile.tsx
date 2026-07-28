import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  tone?: "neutral" | "success" | "danger" | "warn";
  /** Mark at most one tile per screen — the accent ring is reserved for it. */
  primary?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<StatTileProps["tone"]>, string> = {
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
  primary = false,
  className,
}: StatTileProps) {
  return (
    <Card className={cn(primary && "ring-brand/40", className)}>
      <p className="text-label uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 font-mono text-title", primary ? "text-brand" : "text-foreground")}>{value}</p>
      {delta ? <p className={cn("mt-1 text-caption font-mono", TONE_CLASSES[tone])}>{delta}</p> : null}
    </Card>
  );
}
