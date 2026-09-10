import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";
import { EmptyState } from "@/components/shared/empty-state";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

const TYPE_LABEL: Record<string, string> = {
  cash: "Cash",
  savings: "Savings",
  credit: "Credit",
  investment: "Investment",
};

function money(n: number) {
  return `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Read-only account roll-up for the overview. Editing lives on /finance/
 * accounts, where AccountCard's inline balance editor belongs — an overview
 * that also edits turns a glance into a form.
 */
export function AccountsSummaryCard({ accounts }: { accounts: Account[] }) {
  return (
    <Card padding="slotted" className="h-full">
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
        <CardAction>
          <Link
            href="/finance/accounts"
            className="inline-flex items-center gap-1 text-caption font-medium text-brand hover:underline"
          >
            Manage
            <ArrowRight className="size-3" strokeWidth={2.5} />
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent>
        {accounts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            value="$0"
            title="No accounts connected"
            description="Connect a financial account to begin tracking net worth."
            action={
              <Link
                href="/finance/accounts"
                className="inline-flex items-center gap-1 text-body font-medium text-brand hover:underline"
              >
                Add one →
              </Link>
            }
          />
        ) : (
          <ul className="-my-1 divide-y divide-border">
            {accounts.map((account) => {
              const isLiability = Boolean(account.is_liability);
              const balance = Number(account.current_balance);
              // Credit accounts carry a negative running balance as debt
              // accrues (see computeAssetLiabilityTotals); users think of
              // that as an amount owed, so it's shown positive and labelled.
              const shown = isLiability ? Math.abs(balance) : balance;
              return (
                <li key={account.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-body">{account.name}</p>
                    <p className="text-caption text-muted-foreground">
                      {TYPE_LABEL[account.account_type] ?? account.account_type}
                    </p>
                  </div>
                  <span className={cn("tabular shrink-0 text-body font-medium", isLiability && "text-danger")}>
                    {isLiability ? "−" : ""}
                    {money(shown)}
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
