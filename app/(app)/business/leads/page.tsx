import { createClient } from "@/lib/supabase/server";
import { getResearchLeads } from "@/lib/db/queries/lead-research";
import { getContacts, getDeals, getPipelineStages } from "@/lib/db/queries/business";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { BUSINESS_TABS } from "@/lib/nav-items";
import { StartRunForm } from "@/components/business/lead-research/start-run-form";
import { LeadResearchBoard } from "@/components/business/lead-research/lead-research-board";
import type { LeadRowData } from "@/components/business/lead-research/types";

/**
 * The Lead Research cockpit — the one page that turns the fully-built
 * Discovery -> Audit -> Qualification agent (lib/research/run-job.ts) into
 * something you can actually work from a call list. Nothing here re-does
 * ensureDefaultPipelineStagesAction's job (Pipeline page owns that); if no
 * stages exist yet, "Promote to next stage" just has nothing to promote
 * into — the run itself already fails clearly in that case (run-job.ts).
 */
export default async function LeadsPage() {
  const supabase = await createClient();
  const [leads, contacts, deals, stages] = await Promise.all([
    getResearchLeads(supabase),
    getContacts(supabase),
    getDeals(supabase),
    getPipelineStages(supabase),
  ]);

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const dealById = new Map(deals.map((d) => [d.id, d]));
  const rows: LeadRowData[] = leads.map((lead) => ({
    lead,
    contact: contactById.get(lead.contact_id),
    deal: lead.deal_id ? dealById.get(lead.deal_id) : undefined,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Business</p>
          <h1 className="text-xl font-semibold">Lead Research</h1>
        </div>
        <StartRunForm />
      </div>

      <ModuleTabs tabs={BUSINESS_TABS} />

      <LeadResearchBoard rows={rows} stages={stages} />
    </div>
  );
}
