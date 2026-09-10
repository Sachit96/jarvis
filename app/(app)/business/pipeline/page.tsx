import { KanbanSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPipelineStages, getDeals, getContacts, getDealTasks, computePipelineValueByStage } from "@/lib/db/queries/business";
import { ensureDefaultPipelineStagesAction } from "@/actions/business-actions";
import { LeadForm } from "@/components/business/lead-form";
import { DealCard } from "@/components/business/deal-card";
import { DealAgingCard, computeDealAging } from "@/components/business/deal-aging-card";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { BUSINESS_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

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
  const closedStageIds = new Set(stages.filter((s) => s.is_won || s.is_lost).map((s) => s.id));
  const openDeals = deals.filter((d) => !closedStageIds.has(d.stage_id));
  const dealAgingBuckets = computeDealAging(openDeals);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader eyebrow="Business" title="Lead Pipeline" />
        <LeadForm stages={stages} />
      </div>

      <ModuleTabs tabs={BUSINESS_TABS} />

      {stages.length === 0 ? (
        <div className="surface">
          <EmptyState icon={KanbanSquare} title="No pipeline yet" description="Add the stages a deal moves through and the board will appear here." />
        </div>
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
                  <p className="tabular text-xs text-brand">{money(valueByStage.get(stage.id) ?? 0)}</p>
                </div>
                <div className="space-y-2">
                  {stageDeals.length === 0 ? (
                    <p className="rounded-lg bg-white/[0.02] px-3 py-5 text-center text-caption text-foreground-tertiary">
                      No deals in this stage
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

      <DealAgingCard openDealCount={openDeals.length} buckets={dealAgingBuckets} />
    </div>
  );
}
