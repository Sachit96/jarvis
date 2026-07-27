import { createClient } from "@/lib/supabase/server";
import { getBudgets, getMonthTransactions, computeSpendByCategory } from "@/lib/db/queries/finance";
import { BudgetBar } from "@/components/finance/budget-bar";
import { BudgetForm } from "@/components/finance/budget-form";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { FINANCE_TABS } from "@/lib/nav-items";

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
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Finance</p>
          <h1 className="text-xl font-semibold">Budgets</h1>
        </div>
        <BudgetForm />
      </div>

      <ModuleTabs tabs={FINANCE_TABS} />

      <p className="text-sm text-muted-foreground">
        Monthly caps per category, tracked against this month&apos;s spending so far.
      </p>

      {budgets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No budgets yet — set your first monthly cap above.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {budgets.map((budget) => (
            <BudgetBar
              key={budget.id}
              budget={budget}
              spent={spendByCategory.get(budget.category) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
