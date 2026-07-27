"use client";

import { useState, useTransition } from "react";
import { Droplet } from "lucide-react";
import { cn } from "@/lib/utils";
import { addWaterAction } from "@/actions/health-actions";

const QUICK_AMOUNTS = [250, 500, 750];

export function WaterTracker({ totalMl, targetMl }: { totalMl: number; targetMl: number }) {
  const [total, setTotal] = useState(totalMl);
  const [isPending, startTransition] = useTransition();
  const pct = targetMl > 0 ? Math.min(100, Math.round((total / targetMl) * 100)) : 0;

  function handleAdd(amount: number) {
    setTotal((t) => t + amount);
    startTransition(async () => {
      try {
        await addWaterAction(amount);
      } catch {
        setTotal((t) => t - amount);
      }
    });
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", isPending && "opacity-80")}>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Droplet className="h-3.5 w-3.5" /> Water
        </span>
        <span className="font-mono text-brand">
          {total} / {targetMl} ml
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex gap-2">
        {QUICK_AMOUNTS.map((amount) => (
          <button
            key={amount}
            onClick={() => handleAdd(amount)}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            +{amount}ml
          </button>
        ))}
      </div>
    </div>
  );
}
