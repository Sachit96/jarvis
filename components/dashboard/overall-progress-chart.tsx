"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CATEGORY_HEX, CATEGORY_LABEL, type Category } from "@/lib/category-colors";
import type { LifeScoreTrendPoint } from "@/lib/db/queries/life-score";

// Goals has no daily history anywhere in the schema (see life-score.ts) —
// only these four categories get a real, non-fabricated trend line.
const SERIES: Category[] = ["business", "health", "finance", "habits"];

function compactTick(value: number) {
  return String(Math.round(value));
}

function ProgressTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-caption ring-1 ring-border">
      <p className="text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="mt-0.5 flex items-center gap-1.5 font-mono font-medium text-foreground">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: {Math.round(p.value)}
        </p>
      ))}
    </div>
  );
}

export function OverallProgressChart({
  points,
  compact = false,
  className,
}: {
  points: LifeScoreTrendPoint[];
  compact?: boolean;
  className?: string;
}) {
  const hasActivity = points.some((p) => p.business + p.health + p.finance + p.habits > 0);

  return (
    <Card padding={compact ? "compact" : "default"} className={cn(compact && "min-h-[200px]", className)}>
      <header className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Overall Progress</p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={compact ? "h-[132px] w-full" : "h-64 w-full"}>
          {hasActivity ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  {SERIES.map((cat) => (
                    <linearGradient key={cat} id={`progressFill-${cat}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CATEGORY_HEX[cat]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CATEGORY_HEX[cat]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke="var(--muted-foreground)" strokeOpacity={0.15} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={32}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickFormatter={compactTick}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip content={<ProgressTooltip />} cursor={{ stroke: "var(--border)" }} />
                {SERIES.map((cat) => (
                  <Area
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    name={CATEGORY_LABEL[cat]}
                    stroke={CATEGORY_HEX[cat]}
                    strokeWidth={2}
                    fill={`url(#progressFill-${cat})`}
                    animationDuration={600}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-body text-muted-foreground">
              Not enough activity yet to chart a trend.
            </div>
          )}
        </div>
        <ul className="mt-auto flex flex-wrap justify-center gap-x-3 gap-y-1 pt-1.5">
          {SERIES.map((cat) => (
            <li key={cat} className="flex items-center gap-1.5 text-caption text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_HEX[cat] }} />
              {CATEGORY_LABEL[cat]}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
