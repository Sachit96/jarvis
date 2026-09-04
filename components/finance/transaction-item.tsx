"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { deleteTransactionAction } from "@/actions/finance-actions";
import type { Database } from "@/lib/supabase/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

function money(n: number) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TransactionItem({
  transaction,
  accountName,
}: {
  transaction: Transaction;
  accountName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(() => deleteTransactionAction(transaction.id));
  }

  const isIncome = transaction.type === "income";

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-opacity",
        isPending && "opacity-70",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px] uppercase">
            {transaction.category}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">{accountName}</span>
          <span className="font-mono text-xs text-muted-foreground">{transaction.occurred_at}</span>
        </div>
        {transaction.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{transaction.description}</p>
        ) : null}
      </div>
      <p className={cn("shrink-0 font-mono text-sm", isIncome ? "text-success" : "text-danger")}>
        {isIncome ? "+" : "-"}
        {money(transaction.amount)}
      </p>
      <button
        onClick={handleDelete}
        aria-label="Delete transaction"
        className="relative after:absolute after:-inset-3.5 shrink-0 text-muted-foreground hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
