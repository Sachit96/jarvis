"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteBudgetAction } from "@/actions/finance-actions";
import type { Database } from "@/lib/supabase/database.types";

type Budget = Database["public"]["Tables"]["budgets"]["Row"];

function money(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BudgetBar({ budget, spent }: { budget: Budget; spent: number }) {
  const [isPending, startTransition] = useTransition();
  const limit = Number(budget.monthly_limit);
  const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
  const over = spent > limit;

  function handleDelete() {
    startTransition(() => deleteBudgetAction(budget.id));
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 transition-opacity", isPending && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{budget.category}</p>
        <button
          onClick={handleDelete}
          aria-label="Delete budget"
          className="relative after:absolute after:-inset-3.5 text-muted-foreground hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", over ? "bg-danger" : "bg-brand")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={cn("w-24 shrink-0 text-right font-mono text-xs", over ? "text-danger" : "text-brand")}>
          {money(spent)} / {money(limit)}
        </span>
      </div>
    </div>
  );
}
