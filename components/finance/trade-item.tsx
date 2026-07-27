"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { deleteTradeAction } from "@/actions/finance-actions";
import { CloseTradeForm } from "@/components/finance/close-trade-form";
import type { Database } from "@/lib/supabase/database.types";

type Trade = Database["public"]["Tables"]["trades"]["Row"];

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TradeItem({ trade }: { trade: Trade }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(() => deleteTradeAction(trade.id));
  }

  const pnl = trade.pnl !== null ? Number(trade.pnl) : null;

  return (
    <li
      className={cn(
        "rounded-lg border border-border bg-card p-3 transition-opacity",
        isPending && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{trade.asset_pair}</p>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase",
                trade.direction === "long" ? "text-success border-success/40" : "text-danger border-danger/40",
              )}
            >
              {trade.direction}
            </Badge>
            {trade.setup_category ? (
              <Badge variant="secondary" className="text-[10px]">
                {trade.setup_category}
              </Badge>
            ) : null}
            <Badge variant="outline" className="text-[10px] uppercase">
              {trade.status}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Entry {trade.entry_price}
            {trade.exit_price !== null ? ` → Exit ${trade.exit_price}` : ""}
            {trade.quantity !== null ? ` · Qty ${trade.quantity}` : ""}
          </p>
          {trade.notes ? <p className="mt-1 text-xs text-muted-foreground">{trade.notes}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pnl !== null ? (
            <p className={cn("font-mono text-sm", pnl >= 0 ? "text-success" : "text-danger")}>
              {money(pnl)}
            </p>
          ) : null}
          {trade.status === "open" ? <CloseTradeForm trade={trade} /> : null}
          <button
            onClick={handleDelete}
            aria-label="Delete trade"
            className="text-muted-foreground hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
