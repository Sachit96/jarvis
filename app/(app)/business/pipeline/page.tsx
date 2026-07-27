import { createClient } from "@/lib/supabase/server";
import { getPipelineStages, getDeals, getContacts, getDealTasks, computePipelineValueByStage } from "@/lib/db/queries/business";
import { ensureDefaultPipelineStagesAction } from "@/actions/business-actions";
import { LeadForm } from "@/components/business/lead-form";
import { DealCard } from "@/components/business/deal-card";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { BUSINESS_TABS } from "@/lib/nav-items";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function PipelinePage() {
  await ensureDefaultPipelineStagesAction();

  const supabase = await createClient();
  const [stages, deals, contacts] = await Promise.all([
    getPipelineStages(supabase),
    getDeals(supabase),
    getContacts(supabase),
  ]);
  const tasks = await getDealTasks(
    supabase,
    deals.map((d) => d.id),
  );

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const tasksByDeal = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const list = tasksByDeal.get(t.deal_id) ?? [];
    list.push(t);
    tasksByDeal.set(t.deal_id, list);
  }
  const valueByStage = computePipelineValueByStage(deals);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Business</p>
          <h1 className="text-xl font-semibold">Lead Pipeline</h1>
        </div>
        <LeadForm stages={stages} />
      </div>

      <ModuleTabs tabs={BUSINESS_TABS} />

      {stages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No pipeline stages yet.
        </p>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {stages.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage_id === stage.id);
            return (
              <div key={stage.id} className="w-64 shrink-0 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {stage.name}
                  </p>
                  <p className="font-mono text-xs text-brand">{money(valueByStage.get(stage.id) ?? 0)}</p>
                </div>
                <div className="space-y-2">
                  {stageDeals.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                      No deals
                    </p>
                  ) : (
                    stageDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        contact={contactById.get(deal.contact_id)}
                        stages={stages}
                        tasks={tasksByDeal.get(deal.id) ?? []}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
