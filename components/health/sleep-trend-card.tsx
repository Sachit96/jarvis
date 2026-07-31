"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/database.types";

type SleepLog = Database["public"]["Tables"]["sleep_logs"]["Row"];

function SleepTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-caption ring-1 ring-border">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono font-medium text-foreground">{payload[0].value.toFixed(1)}h</p>
    </div>
  );
}

export function SleepTrendCard({ entries }: { entries: SleepLog[] }) {
  const points = entries.map((e) => ({
    date: new Date(e.log_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    hours: Number(e.hours_slept),
  }));
  const avg = entries.length > 0 ? entries.reduce((s, e) => s + Number(e.hours_slept), 0) / entries.length : 0;
  const latest = entries.length > 0 ? entries[entries.length - 1] : null;

  return (
    <Card>
      <p className="text-label uppercase tracking-wide text-muted-foreground">Sleep</p>
      {latest ? (
        <>
          <p className="mt-1 font-mono text-title font-bold text-foreground">{Number(latest.hours_slept).toFixed(1)}h</p>
          <p className="mt-0.5 text-caption text-muted-foreground">
            {avg.toFixed(1)}h average over {entries.length} night{entries.length === 1 ? "" : "s"}
          </p>
        </>
      ) : (
        <p className="mt-1 text-body text-muted-foreground">No entries yet.</p>
      )}

      {points.length > 1 ? (
        <div className="mt-4 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--muted-foreground)" strokeOpacity={0.15} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={32} />
              <YAxis domain={[0, 12]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<SleepTooltip />} cursor={{ fill: "var(--border)", opacity: 0.3 }} />
              <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
                {points.map((p, i) => (
                  <Cell key={i} fill={p.hours >= 7 ? "#3b82f6" : "#f97316"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </Card>
  );
}
