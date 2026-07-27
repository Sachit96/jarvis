import { createClient } from "@/lib/supabase/server";
import { getAccounts, getTransactions } from "@/lib/db/queries/finance";
import { TransactionForm } from "@/components/finance/transaction-form";
import { TransactionItem } from "@/components/finance/transaction-item";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { FINANCE_TABS } from "@/lib/nav-items";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; category?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const accounts = await getAccounts(supabase);
  const transactions = await getTransactions(supabase, {
    accountId: params.account_id && params.account_id !== "all" ? params.account_id : undefined,
    category: params.category || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  });
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Finance</p>
          <h1 className="text-xl font-semibold">Transactions</h1>
        </div>
        <TransactionForm accounts={accounts} />
      </div>

      <ModuleTabs tabs={FINANCE_TABS} />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground">Account</label>
          <Select name="account_id" defaultValue={params.account_id ?? "all"}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground">Category</label>
          <Input name="category" defaultValue={params.category ?? ""} className="w-32" placeholder="All" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground">From</label>
          <Input name="from" type="date" defaultValue={params.from ?? ""} className="w-auto" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-muted-foreground">To</label>
          <Input name="to" type="date" defaultValue={params.to ?? ""} className="w-auto" />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Filter
        </Button>
      </form>

      {transactions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No transactions match these filters.
        </p>
      ) : (
        <ul className="space-y-2">
          {transactions.map((t) => (
            <TransactionItem
              key={t.id}
              transaction={t}
              accountName={accountNameById.get(t.account_id) ?? "Unknown"}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
