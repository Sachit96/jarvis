"use client";

import { Bar, BarChart, ResponsiveContainer, Cell } from "recharts";
import { Card } from "@/components/ui/card";

interface Point {
  date: string;
  net: number;
}

/** Last-14-days net-cashflow bar sparkline — a compact companion to the full CashflowTrendChart, for the right rail. */
export function CashflowSparklineCard({ points }: { points: Point[] }) {
  const recent = points.slice(-14);

  return (
    <Card>
      <p className="text-label uppercase tracking-wide text-muted-foreground">Daily Net Cashflow</p>
      <p className="mt-0.5 text-caption text-muted-foreground">Last 14 days</p>
      <div className="mt-3 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={recent} barCategoryGap="20%">
            <Bar dataKey="net" radius={[2, 2, 2, 2]}>
              {recent.map((p, i) => (
                <Cell key={i} fill={p.net >= 0 ? "#22c55e" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex justify-center gap-4 text-caption text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
          Net positive
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
          Net negative
        </li>
      </ul>
    </Card>
  );
}
