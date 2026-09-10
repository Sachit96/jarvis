import { FileText, Receipt, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getContracts, getContacts, computeMrr } from "@/lib/db/queries/business";
import { ContractForm } from "@/components/business/contract-form";
import { ContractCard } from "@/components/business/contract-card";
import { StatTile } from "@/components/shared/stat-tile";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { BUSINESS_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default async function RevenuePage() {
  const supabase = await createClient();
  const [contracts, contacts] = await Promise.all([getContracts(supabase), getContacts(supabase)]);
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const mrr = computeMrr(contracts);
  const activeCount = contracts.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader eyebrow="Business" title="Revenue &amp; Contracts" />
        <ContractForm contacts={contacts} />
      </div>

      <ModuleTabs tabs={BUSINESS_TABS} />

      <div className="grid grid-cols-2 gap-4">
        <StatTile label="MRR" value={`$${mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} tone="success" icon={TrendingUp} />
        <StatTile label="Active Contracts" value={String(activeCount)} icon={FileText} />
      </div>

      {contracts.length === 0 ? (
        <div className="surface">
          <EmptyState icon={Receipt} title="No contracts yet" description="Recurring revenue is calculated from active contracts. Add one once a client is signed." />
        </div>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {contracts.map((contract) => (
            <ContractCard key={contract.id} contract={contract} contact={contactById.get(contract.contact_id)} />
          ))}
        </div>
      )}
    </div>
  );
}
