import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  tone?: "neutral" | "success" | "danger" | "warn";
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "text-muted-foreground",
  success: "text-success",
  danger: "text-danger",
  warn: "text-warn",
};

/** The JARVIS "glowing number card" — a thin accent top-border, not a full glow. */
export function StatTile({
  label,
  value,
  delta,
  tone = "neutral",
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 border-t-2 border-t-brand",
        className,
      )}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl text-foreground">{value}</p>
      {delta ? (
        <p className={cn("mt-1 font-mono text-xs", TONE_CLASSES[tone])}>
          {delta}
        </p>
      ) : null}
    </div>
  );
}
