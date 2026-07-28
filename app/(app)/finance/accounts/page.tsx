import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/db/queries/finance";
import { AccountCard } from "@/components/finance/account-card";
import { AccountForm } from "@/components/finance/account-form";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { FINANCE_TABS } from "@/lib/nav-items";

export default async function AccountsPage() {
  const supabase = await createClient();
  const accounts = await getAccounts(supabase);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Finance</p>
          <h1 className="text-xl font-semibold">Accounts</h1>
        </div>
        <AccountForm />
      </div>

      <ModuleTabs tabs={FINANCE_TABS} />

      {accounts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No accounts yet — add your first one above.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
