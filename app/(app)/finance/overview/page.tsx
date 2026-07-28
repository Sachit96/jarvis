import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getAccounts,
  getMonthTransactions,
  getRecentTransactions,
  computeAssetLiabilityTotals,
  computeMonthlyPnl,
  computeSpendByCategory,
  computeDailyCashflow,
} from "@/lib/db/queries/finance";
import { NetWorthWidget } from "@/components/finance/net-worth-widget";
import { MonthlyPnlCard } from "@/components/finance/monthly-pnl-card";
import { CashflowTrendChart } from "@/components/finance/cashflow-trend-chart";
import { SpendByCategoryChart } from "@/components/finance/spend-by-category-chart";
import { AccountCard } from "@/components/finance/account-card";
import { AccountForm } from "@/components/finance/account-form";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { FINANCE_TABS } from "@/lib/nav-items";

export default async function FinanceOverviewPage() {
  const supabase = await createClient();
  const [accounts, monthTransactions, recentTransactions] = await Promise.all([
    getAccounts(supabase),
    getMonthTransactions(supabase),
    getRecentTransactions(supabase),
  ]);

  const totals = computeAssetLiabilityTotals(accounts);
  const pnl = computeMonthlyPnl(monthTransactions);
  const spendByCategory = computeSpendByCategory(monthTransactions);
  const cashflowPoints = computeDailyCashflow(recentTransactions);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-label uppercase tracking-wide text-muted-foreground">Finance</p>
        <h1 className="text-title">Overview</h1>
      </div>

      <ModuleTabs tabs={FINANCE_TABS} />

      <NetWorthWidget {...totals} />
      <MonthlyPnlCard {...pnl} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CashflowTrendChart points={cashflowPoints} />
        </div>
        <div className="lg:col-span-2">
          <SpendByCategoryChart spendByCategory={spendByCategory} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-heading text-muted-foreground">Accounts</h2>
          <AccountForm />
        </div>
        {accounts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            description="Add a cash, savings, credit, or investment account to start tracking your net worth."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
