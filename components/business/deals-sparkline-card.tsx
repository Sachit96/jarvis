"use client";

import { Bar, BarChart, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";

interface Point {
  date: string;
  count: number;
}

/** Deals created per day, last 14 days — a compact companion to the pipeline donut. */
export function DealsSparklineCard({ points }: { points: Point[] }) {
  const recent = points.slice(-14);
  const total = recent.reduce((sum, p) => sum + p.count, 0);

  return (
    <Card>
      <p className="text-label uppercase tracking-wide text-muted-foreground">New Deals</p>
      <p className="mt-0.5 text-caption text-muted-foreground">{total} in the last 14 days</p>
      <div className="mt-3 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={recent} barCategoryGap="20%">
            <Bar dataKey="count" radius={[2, 2, 2, 2]} fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
