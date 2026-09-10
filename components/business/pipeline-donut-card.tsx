"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { ChartFrame } from "@/components/shared/chart-frame";
import Link from "next/link";
import { ArrowRight, KanbanSquare } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/database.types";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

type PipelineStage = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type Deal = Database["public"]["Tables"]["deals"]["Row"];

/**
 * Chart slots in order (see --chart-* in globals.css), not six hard-coded
 * hexes from before this palette existed. The donut was rendering violet,
 * blue, teal, orange, pink and green — an entire second colour scheme on the
 * Business dashboard, none of which appeared anywhere else in the product.
 */
const SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-caption ring-1 ring-border">
      <p className="text-muted-foreground">{payload[0].name}</p>
      <p className="mt-0.5 tabular font-medium text-foreground">${payload[0].value.toLocaleString()}</p>
    </div>
  );
}

/**
 * The single "pipeline by stage" view for the Business Dashboard — a donut
 * for the value split plus a legend that also carries deal counts, so this
 * one card fully replaces what used to be a separate plain-text breakdown
 * list elsewhere on the page.
 */
export function PipelineDonutCard({ stages, deals }: { stages: PipelineStage[]; deals: Deal[] }) {
  // recharts animates in JS and never reads the media query, so the
  // preference has to be threaded in by hand.
  const reducedMotion = useReducedMotion();

  const rows = stages.map((s) => {
    const stageDeals = deals.filter((d) => d.stage_id === s.id);
    return {
      id: s.id,
      name: s.name,
      value: stageDeals.reduce((sum, d) => sum + Number(d.value), 0),
      count: stageDeals.length,
    };
  });
  const slices = rows.filter((r) => r.value > 0);
  const total = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <Card>
      <p className="eyebrow">Pipeline by Stage</p>
      {rows.every((r) => r.count === 0) ? (
        <EmptyState
          icon={KanbanSquare}
          title="No deals yet"
          description="Deals you add will split by stage here, with the value sitting in each."
        />
      ) : (
        <>
          {/* A fixed square rather than a capped percentage width: a donut is
              square, and giving the frame a size it cannot disagree with
              removes the class of bug where the chart draws at one width
              inside a box of another and hangs out of its own centre. */}
          {slices.length > 0 ? (
            <div className="relative mx-auto mt-3 size-44">
              <ChartFrame height={176} width={176}>
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="90%"
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                    isAnimationActive={!reducedMotion}
                  >
                    {slices.map((s, i) => (
                      <Cell key={s.id} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ChartFrame>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="tabular font-display text-metric text-foreground">{money(total)}</p>
                <p className="eyebrow mt-1">Total</p>
              </div>
            </div>
          ) : null}
          <ul className="mt-4 space-y-1.5">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between text-caption">
                <span className="flex items-center gap-2 text-foreground-tertiary">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                  {r.name}
                </span>
                <span className="tabular text-foreground">
                  {r.count} deal(s) · {money(r.value)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href="/business/pipeline" className="mt-4 inline-flex items-center gap-1 text-caption font-medium text-brand hover:underline">
        View Details
        <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
      </Link>
    </Card>
  );
}
