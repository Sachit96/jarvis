import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/db/queries/finance";
import { AccountCard } from "@/components/finance/account-card";
import { AccountForm } from "@/components/finance/account-form";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { FINANCE_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default async function AccountsPage() {
  const supabase = await createClient();
  const accounts = await getAccounts(supabase);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader eyebrow="Finance" title="Accounts" />
        <AccountForm />
      </div>

      <ModuleTabs tabs={FINANCE_TABS} />

      {accounts.length === 0 ? (
        <div className="surface">
          <EmptyState icon={Wallet} value="$0" title="No accounts connected" description="Connect an account above to begin tracking net worth and cash flow." />
        </div>
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
