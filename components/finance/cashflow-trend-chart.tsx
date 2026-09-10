"use client";
import { TrendingUp } from "lucide-react";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/shared/empty-state";

interface Point {
  date: string;
  income: number;
  expense: number;
  net: number;
}

/**
 * Income and expense are two series to tell apart, so they get categorical
 * colors — but NOT the obvious green/red pair. Green #16a34a against red
 * #dc2626 measures 5.0 OKLab ΔE under deuteranopia, i.e. the single most
 * common form of colorblindness renders the two lines the same. Blue is the
 * nearest choice that survives simulation (30.3 ΔE) while keeping income on
 * the app's money-green. The legend below carries the names either way, so
 * identity never rests on hue alone.
 */
const chartConfig = {
  income: { label: "Income", color: "var(--chart-1)" },
  expense: { label: "Spending", color: "var(--chart-2)" },
} satisfies ChartConfig;

// Intl's compact notation keeps one decimal where it's needed, so 1,800 and
// 2,400 don't both collapse to "$2k" and print the same tick label twice.
const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});
const compactMoney = (value: number) => `$${compact.format(value)}`;

export function CashflowTrendChart({ points }: { points: Point[] }) {
  const hasActivity = points.some((p) => p.income !== 0 || p.expense !== 0);

  // Plotted cumulatively rather than per-day. Income arrives in a few large
  // lumps and spending trickles out daily, so on raw daily values the income
  // spikes set the y-scale and flatten spending into a line along the axis —
  // the exact comparison the card exists to show. Running totals put both on
  // the same footing: two rising lines whose gap IS the month's net, and
  // whose crossing point is the moment spending overtook earning.
  // Accumulated off the previous element rather than a running counter
  // outside the callback: closing over a mutable local during render is what
  // the React Compiler flags, since a re-render re-enters the callback with
  // the counter already advanced.
  const series = points.reduce<{ date: string; income: number; expense: number }[]>((acc, p) => {
    const prev = acc[acc.length - 1];
    acc.push({
      date: p.date,
      income: (prev?.income ?? 0) + p.income,
      expense: (prev?.expense ?? 0) + p.expense,
    });
    return acc;
  }, []);

  const totals = series[series.length - 1] ?? { income: 0, expense: 0 };

  return (
    <Card padding="slotted" className="h-full">
      <CardHeader>
        <CardTitle>Cashflow</CardTitle>
        <CardDescription>Running totals, last 30 days</CardDescription>
        <CardAction>
          <div className="tabular text-right">
            <p className="text-heading text-foreground">
              {totals.income - totals.expense >= 0 ? "+" : "−"}$
              {Math.abs(totals.income - totals.expense).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-caption text-muted-foreground">net, 30 days</p>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent>
        {hasActivity ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                interval="preserveStartEnd"
                minTickGap={40}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={compactMoney}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<ChartTooltipContent indicator="line" />} />
              <ChartLegend content={<ChartLegendContent />} />
              {/* dot={false} keeps 30 points readable as a shape; activeDot
                  gives the hover a target big enough to hit on touch. */}
              <Line
                dataKey="income"
                type="monotone"
                stroke="var(--color-income)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                dataKey="expense"
                type="monotone"
                stroke="var(--color-expense)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No cash flow yet"
            description="Thirty days of running totals appear here once transactions exist."
          />
        )}
      </CardContent>
    </Card>
  );
}
