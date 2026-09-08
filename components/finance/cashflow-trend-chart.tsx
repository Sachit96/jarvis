"use client";

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
  expense: { label: "Expense", color: "var(--chart-2)" },
} satisfies ChartConfig;

const compactMoney = (value: number) =>
  Math.abs(value) >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`;

export function CashflowTrendChart({ points }: { points: Point[] }) {
  const hasActivity = points.some((p) => p.income !== 0 || p.expense !== 0);

  const totals = points.reduce(
    (acc, p) => ({ income: acc.income + p.income, expense: acc.expense + p.expense }),
    { income: 0, expense: 0 },
  );

  return (
    <Card padding="slotted" className="h-full">
      <CardHeader>
        <CardTitle>Cashflow</CardTitle>
        <CardDescription>Income against spending, last 30 days</CardDescription>
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
            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          <div className="flex h-56 items-center justify-center text-body text-muted-foreground">
            No transactions in the last 30 days yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
