import { TrendingUp, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getContracts, getContacts, computeMrr } from "@/lib/db/queries/business";
import { ContractForm } from "@/components/business/contract-form";
import { ContractCard } from "@/components/business/contract-card";
import { StatTile } from "@/components/shared/stat-tile";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { BUSINESS_TABS } from "@/lib/nav-items";

export default async function RevenuePage() {
  const supabase = await createClient();
  const [contracts, contacts] = await Promise.all([getContracts(supabase), getContacts(supabase)]);
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const mrr = computeMrr(contracts);
  const activeCount = contracts.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Business</p>
          <h1 className="text-xl font-semibold">Revenue &amp; Contracts</h1>
        </div>
        <ContractForm contacts={contacts} />
      </div>

      <ModuleTabs tabs={BUSINESS_TABS} />

      <div className="grid grid-cols-2 gap-4">
        <StatTile label="MRR" value={`$${mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} tone="success" icon={TrendingUp} category="business" />
        <StatTile label="Active Contracts" value={String(activeCount)} icon={FileText} category="business" />
      </div>

      {contracts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No contracts yet — add one above once you have a client.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {contracts.map((contract) => (
            <ContractCard key={contract.id} contract={contract} contact={contactById.get(contract.contact_id)} />
          ))}
        </div>
      )}
    </div>
  );
}
