import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DetailRow {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}

const TONE_CLASS: Record<NonNullable<DetailRow["tone"]>, string> = {
  neutral: "text-foreground",
  success: "text-success",
  danger: "text-danger",
};

/**
 * A compact label/value list card — used in dashboard right rails to carry
 * forward specific real numbers (e.g. Assets, Liabilities, Win Rate) that
 * would otherwise need a full standalone widget, without repeating a
 * headline number that's already shown elsewhere on the same page (e.g.
 * Net Worth, MRR, a composite score).
 *
 * `fill` marks this instance as its column's filler (flex-1, footer pinned
 * to the bottom via mt-auto) — only one DetailStatsCard per column should
 * ever set this.
 */
export function DetailStatsCard({
  title,
  rows,
  footerLabel,
  footerHref,
  compact = false,
  fill = false,
  className,
}: {
  title: string;
  rows: DetailRow[];
  footerLabel: string;
  footerHref: string;
  compact?: boolean;
  fill?: boolean;
  className?: string;
}) {
  return (
    <Card padding={compact ? "compact" : "default"} className={cn("min-h-0", className)}>
      <header className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between text-[13px]">
              <span className="text-muted-foreground">{row.label}</span>
              <span className={`font-mono font-medium tabular-nums ${TONE_CLASS[row.tone ?? "neutral"]}`}>{row.value}</span>
            </div>
          ))}
        </div>
        <Link
          href={footerHref}
          className={cn("inline-flex items-center gap-1 pt-3 text-[13px] font-medium text-brand hover:underline", fill && "mt-auto")}
        >
          {footerLabel}
          <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
        </Link>
      </div>
    </Card>
  );
}
