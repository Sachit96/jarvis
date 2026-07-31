"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/database.types";

type PipelineStage = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type Deal = Database["public"]["Tables"]["deals"]["Row"];

const SLICE_COLORS = ["#8b5cf6", "#3b82f6", "#2dd4bf", "#f97316", "#ec4899", "#22c55e"];

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-caption ring-1 ring-border">
      <p className="text-muted-foreground">{payload[0].name}</p>
      <p className="mt-0.5 font-mono font-medium text-foreground">${payload[0].value.toLocaleString()}</p>
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
      <p className="text-label uppercase tracking-wide text-muted-foreground">Pipeline by Stage</p>
      {rows.every((r) => r.count === 0) ? (
        <p className="mt-3 text-body text-muted-foreground">No deals yet.</p>
      ) : (
        <>
          {slices.length > 0 ? (
            <div className="relative mt-2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
                    {slices.map((s, i) => (
                      <Cell key={s.id} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="font-mono text-heading text-foreground">{money(total)}</p>
                <p className="text-caption text-muted-foreground">total</p>
              </div>
            </div>
          ) : null}
          <ul className="mt-4 space-y-1.5">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between text-caption">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                  {r.name}
                </span>
                <span className="font-mono text-foreground">
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
