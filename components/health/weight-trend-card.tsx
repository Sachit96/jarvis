"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { Card } from "@/components/ui/card";
import { deleteBodyMetricAction } from "@/actions/health-actions";
import { kgToLbs, formatLbs } from "@/lib/units";
import type { Database } from "@/lib/supabase/database.types";

type BodyMetric = Database["public"]["Tables"]["body_metrics"]["Row"];

function WeightTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-caption ring-1 ring-border">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono font-medium text-foreground">{payload[0].value.toFixed(1)} lbs</p>
    </div>
  );
}

export function WeightTrendCard({ entries }: { entries: BodyMetric[] }) {
  const [isPending, startTransition] = useTransition();
  const points = entries.map((e) => ({
    date: new Date(e.logged_at + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    lbs: Number(kgToLbs(Number(e.weight_kg)).toFixed(1)),
  }));
  const latest = entries.length > 0 ? entries[entries.length - 1] : null;
  const first = entries.length > 0 ? entries[0] : null;
  const delta = latest && first ? kgToLbs(Number(latest.weight_kg) - Number(first.weight_kg)) : 0;

  function handleDeleteLatest() {
    if (!latest) return;
    startTransition(() => deleteBodyMetricAction(latest.id));
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-label uppercase tracking-wide text-muted-foreground">Weight</p>
          {latest ? (
            <>
              <p className="mt-1 font-mono text-title font-bold text-foreground">{formatLbs(Number(latest.weight_kg), 1)} lbs</p>
              <p className={`mt-0.5 text-caption ${delta > 0 ? "text-danger" : delta < 0 ? "text-success" : "text-muted-foreground"}`}>
                {delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} lbs over ${entries.length} entries`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-body text-muted-foreground">No entries yet.</p>
          )}
        </div>
        {latest ? (
          <button onClick={handleDeleteLatest} disabled={isPending} aria-label="Delete latest entry" className="text-muted-foreground hover:text-danger">
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {points.length > 1 ? (
        <div className="mt-4 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--muted-foreground)" strokeOpacity={0.15} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={32} />
              <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<WeightTooltip />} cursor={{ stroke: "var(--border)" }} />
              <Area type="monotone" dataKey="lbs" stroke="#ef4444" strokeWidth={2} fill="url(#weightFill)" animationDuration={600} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </Card>
  );
}
