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
import { FinanceKpis } from "@/components/finance/finance-kpis";
import { CashflowTrendChart } from "@/components/finance/cashflow-trend-chart";
import { SpendByCategoryChart } from "@/components/finance/spend-by-category-chart";
import { RecentTransactionsCard } from "@/components/finance/recent-transactions-card";
import { AccountsSummaryCard } from "@/components/finance/accounts-summary-card";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { FINANCE_TABS } from "@/lib/nav-items";

/** Liquid accounts — what could actually be spent today, so investments are out. */
const CASH_TYPES = new Set(["cash", "savings"]);

function lastMonth(reference = new Date()) {
  return new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
}

export default async function FinanceOverviewPage() {
  const supabase = await createClient();
  const [accounts, monthTransactions, prevMonthTransactions, recentTransactions] = await Promise.all([
    getAccounts(supabase),
    getMonthTransactions(supabase),
    // Drives the KPI deltas. Without it the badges would have nothing real
    // to compare against, and a KPI with an invented delta is worse than one
    // with no delta at all.
    getMonthTransactions(supabase, lastMonth()),
    getRecentTransactions(supabase),
  ]);

  const totals = computeAssetLiabilityTotals(accounts);
  const pnl = computeMonthlyPnl(monthTransactions);
  const prevPnl = computeMonthlyPnl(prevMonthTransactions);
  const spendByCategory = computeSpendByCategory(monthTransactions);
  const cashflowPoints = computeDailyCashflow(recentTransactions);

  const availableCash = accounts
    .filter((a) => !a.is_liability && CASH_TYPES.has(a.account_type))
    .reduce((sum, a) => sum + Number(a.current_balance), 0);

  const monthLabel = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="eyebrow">Finance</p>
        <h1 className="text-display">Overview</h1>
        <p className="text-body text-muted-foreground">{monthLabel}</p>
      </div>

      <ModuleTabs tabs={FINANCE_TABS} />

      <FinanceKpis
        netWorth={totals.netWorth}
        availableCash={availableCash}
        monthSpend={pnl.expense}
        monthIncome={pnl.income}
        previous={{ spend: prevPnl.expense, income: prevPnl.income }}
      />

      {/* 12-column grid rather than fixed pixel columns so the split holds
          at every width — the chart needs the majority share, and the two
          list cards below are equal-weight. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <CashflowTrendChart points={cashflowPoints} />
        </div>
        <div className="xl:col-span-5">
          <SpendByCategoryChart spendByCategory={spendByCategory} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <RecentTransactionsCard transactions={recentTransactions} />
        </div>
        <div className="xl:col-span-5">
          <AccountsSummaryCard accounts={accounts} />
        </div>
      </div>
    </div>
  );
}
