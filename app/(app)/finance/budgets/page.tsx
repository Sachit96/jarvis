import { PiggyBank } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getBudgets, getMonthTransactions, computeSpendByCategory } from "@/lib/db/queries/finance";
import { BudgetBar } from "@/components/finance/budget-bar";
import { BudgetForm } from "@/components/finance/budget-form";
import { SpendByCategoryChart } from "@/components/finance/spend-by-category-chart";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { FINANCE_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default async function BudgetsPage() {
  const supabase = await createClient();
  const [budgets, monthTransactions] = await Promise.all([
    getBudgets(supabase),
    getMonthTransactions(supabase),
  ]);
  const spendByCategory = computeSpendByCategory(monthTransactions);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader eyebrow="Finance" title="Budgets" />
        <BudgetForm />
      </div>

      <ModuleTabs tabs={FINANCE_TABS} />

      <p className="text-sm text-muted-foreground">
        Monthly caps per category, tracked against this month&apos;s spending so far.
      </p>

      {budgets.length === 0 ? (
        <div className="surface">
          <EmptyState icon={PiggyBank} title="No budgets set" description="Set a monthly cap for a category and this month\u2019s spend will track against it." />
        </div>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {budgets.map((budget) => (
            <BudgetBar
              key={budget.id}
              budget={budget}
              spent={spendByCategory.get(budget.category) ?? 0}
            />
          ))}
        </div>
      )}

      <SpendByCategoryChart spendByCategory={spendByCategory} />
    </div>
  );
}
