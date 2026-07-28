"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";

const SLICE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

interface Slice {
  category: string;
  amount: number;
}

function CategoryTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-caption ring-1 ring-white/[0.08]">
      <p className="text-muted-foreground">{payload[0].name}</p>
      <p className="mt-0.5 font-mono font-medium text-foreground">${payload[0].value.toLocaleString()}</p>
    </div>
  );
}

export function SpendByCategoryChart({ spendByCategory }: { spendByCategory: Map<string, number> }) {
  const slices: Slice[] = [...spendByCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const total = slices.reduce((sum, s) => sum + s.amount, 0);

  return (
    <Card>
      <p className="text-heading">Spending by category</p>
      <p className="mt-0.5 text-caption text-muted-foreground">This month&apos;s expenses, top 5 categories.</p>

      {slices.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-body text-muted-foreground">
          No expenses logged this month yet.
        </div>
      ) : (
        <>
          <div className="relative mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amount"
                  nameKey="category"
                  innerRadius="62%"
                  outerRadius="90%"
                  paddingAngle={2}
                  animationDuration={600}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {slices.map((s, i) => (
                    <Cell key={s.category} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CategoryTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-mono text-heading text-foreground">${total.toLocaleString()}</p>
              <p className="text-caption text-muted-foreground">total</p>
            </div>
          </div>
          <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
            {slices.map((s, i) => (
              <li key={s.category} className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                {s.category}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
