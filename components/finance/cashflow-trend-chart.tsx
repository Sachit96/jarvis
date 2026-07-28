"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";

interface Point {
  date: string;
  income: number;
  expense: number;
  net: number;
}

function CashflowTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-caption ring-1 ring-white/[0.08]">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono font-medium text-foreground">
        {payload[0].value >= 0 ? "+" : "-"}${Math.abs(payload[0].value).toLocaleString()}
      </p>
    </div>
  );
}

export function CashflowTrendChart({ points }: { points: Point[] }) {
  const hasActivity = points.some((p) => p.income !== 0 || p.expense !== 0);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-heading">Cashflow trend</p>
          <p className="mt-0.5 text-caption text-muted-foreground">Net income minus expenses per day, last 30 days.</p>
        </div>
      </div>
      <div className="mt-4 h-56">
        {hasActivity ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cashflowFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--muted-foreground)" strokeOpacity={0.15} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={32}
              />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<CashflowTooltip />} cursor={{ stroke: "var(--border)" }} />
              <Area
                type="monotone"
                dataKey="net"
                stroke="var(--brand)"
                strokeWidth={2}
                fill="url(#cashflowFill)"
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-body text-muted-foreground">
            No transactions in the last 30 days yet.
          </div>
        )}
      </div>
    </Card>
  );
}
