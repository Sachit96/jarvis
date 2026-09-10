"use client";

import { Bar, BarChart } from "recharts";
import { ChartFrame } from "@/components/shared/chart-frame";
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
      <p className="eyebrow">New Deals</p>
      <p className="mt-0.5 text-caption text-muted-foreground">{total} in the last 14 days</p>
      <div className="mt-3 h-20">
        <ChartFrame height={80}>
          <BarChart data={recent} barCategoryGap="20%">
            <Bar dataKey="count" radius={[2, 2, 2, 2]} fill="var(--chart-primary)" />
          </BarChart>
        </ChartFrame>
      </div>
    </Card>
  );
}
