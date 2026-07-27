import { createClient } from "@/lib/supabase/server";
import {
  getAccounts,
  getMonthTransactions,
  computeAssetLiabilityTotals,
  computeMonthlyPnl,
} from "@/lib/db/queries/finance";
import { NetWorthWidget } from "@/components/finance/net-worth-widget";
import { MonthlyPnlCard } from "@/components/finance/monthly-pnl-card";
import { AccountCard } from "@/components/finance/account-card";
import { AccountForm } from "@/components/finance/account-form";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { FINANCE_TABS } from "@/lib/nav-items";

export default async function FinanceOverviewPage() {
  const supabase = await createClient();
  const [accounts, monthTransactions] = await Promise.all([
    getAccounts(supabase),
    getMonthTransactions(supabase),
  ]);

  const totals = computeAssetLiabilityTotals(accounts);
  const pnl = computeMonthlyPnl(monthTransactions);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Finance</p>
        <h1 className="text-xl font-semibold">Overview</h1>
      </div>

      <ModuleTabs tabs={FINANCE_TABS} />

      <NetWorthWidget {...totals} />
      <MonthlyPnlCard {...pnl} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Accounts</h2>
          <AccountForm />
        </div>
        {accounts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No accounts yet — add your first one above.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
