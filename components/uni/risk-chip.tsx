import { cn } from "@/lib/utils";

/** 0-30 low / 31-60 medium / 61-100 high — thresholds chosen so a course only reads "high risk" when riskScore's own signals (grade gap, overdue items, imminent deadline) are genuinely stacking up, not from a single mild signal. */
export function RiskChip({ score }: { score: number }) {
  const tone = score >= 61 ? "danger" : score >= 31 ? "warn" : "success";
  const label = score >= 61 ? "High risk" : score >= 31 ? "Medium risk" : "On track";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium tabular-nums",
        tone === "danger" && "bg-danger/10 text-danger",
        tone === "warn" && "bg-warn/10 text-warn",
        tone === "success" && "bg-success/10 text-success",
      )}
    >
      {label} · {score}
    </span>
  );
}
