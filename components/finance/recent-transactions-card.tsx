import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";
import { EmptyState } from "@/components/shared/empty-state";
import { shortDate } from "@/lib/date";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

function money(n: number) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Replaces the previous single-latest-transaction card. One row of data in a
 * whole card is a stat tile's job at best, and this one spent four of its
 * five rows on labels plus a hardcoded "Status: Logged" that was true of
 * every transaction by definition. A short ledger answers the question the
 * card is actually there for — "what have I been spending on" — in the same
 * space.
 */
export function RecentTransactionsCard({ transactions }: { transactions: Transaction[] }) {
  // Query order is ascending (it feeds the trend chart), so the newest are
  // at the end — take from there and flip, rather than re-querying.
  const rows = transactions.slice(-6).reverse();

  return (
    <Card padding="slotted" className="h-full">
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <CardAction>
          <Link
            href="/finance/transactions"
            className="inline-flex items-center gap-1 text-caption font-medium text-brand hover:underline"
          >
            View all
            <ArrowRight className="size-3" strokeWidth={2.5} />
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions"
            description="Log income and spending and the most recent land here."
          />
        ) : (
          <ul className="-my-1 divide-y divide-border">
            {rows.map((t) => {
              const isIncome = t.type === "income";
              return (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      isIncome ? "bg-success/12 text-success" : "bg-white/[0.06] text-muted-foreground",
                    )}
                  >
                    {isIncome ? (
                      <ArrowDownLeft className="size-4" strokeWidth={2} />
                    ) : (
                      <ArrowUpRight className="size-4" strokeWidth={2} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body">{t.description || t.category}</p>
                    <p className="text-caption text-muted-foreground">
                      {t.category} · {shortDate(t.occurred_at)}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "tabular shrink-0 text-body font-medium",
                      isIncome ? "text-success" : "text-foreground",
                    )}
                  >
                    {isIncome ? "+" : "−"}
                    {money(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
