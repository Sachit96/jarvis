import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

function money(n: number) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function LatestTransactionCard({ transaction }: { transaction: Transaction | null }) {
  return (
    <Card>
      <p className="text-label uppercase tracking-wide text-muted-foreground">Latest Transaction</p>
      {!transaction ? (
        <p className="mt-3 text-body text-muted-foreground">No transactions logged yet.</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between text-body">
            <span className="text-muted-foreground">Description</span>
            <span className="max-w-[60%] truncate text-right font-medium text-foreground">
              {transaction.description || transaction.category}
            </span>
          </div>
          <div className="flex items-center justify-between text-body">
            <span className="text-muted-foreground">Amount</span>
            <span className={`font-mono font-medium ${transaction.type === "income" ? "text-success" : "text-danger"}`}>
              {transaction.type === "income" ? "+" : "-"}
              {money(transaction.amount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-body">
            <span className="text-muted-foreground">Date</span>
            <span className="font-mono text-caption text-foreground">{transaction.occurred_at}</span>
          </div>
          <div className="flex items-center justify-between text-body">
            <span className="text-muted-foreground">Status</span>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-caption font-medium text-success">Logged</span>
          </div>
        </div>
      )}
      <Link href="/finance/transactions" className="mt-4 inline-flex items-center gap-1 text-caption font-medium text-brand hover:underline">
        View All Transactions
        <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
      </Link>
    </Card>
  );
}
