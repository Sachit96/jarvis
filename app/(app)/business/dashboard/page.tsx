import { createClient } from "@/lib/supabase/server";
import { getPipelineStages, getDeals, getContracts, computeMrr } from "@/lib/db/queries/business";
import { StatTile } from "@/components/shared/stat-tile";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { BUSINESS_TABS } from "@/lib/nav-items";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function BusinessDashboardPage() {
  const supabase = await createClient();
  const [stages, deals, contracts] = await Promise.all([
    getPipelineStages(supabase),
    getDeals(supabase),
    getContracts(supabase),
  ]);

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const openDeals = deals.filter((d) => {
    const stage = stageById.get(d.stage_id);
    return stage && !stage.is_won && !stage.is_lost;
  });
  const wonDeals = deals.filter((d) => stageById.get(d.stage_id)?.is_won);
  const lostDeals = deals.filter((d) => stageById.get(d.stage_id)?.is_lost);
  const closedCount = wonDeals.length + lostDeals.length;
  const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;
  const openValue = openDeals.reduce((sum, d) => sum + Number(d.value), 0);
  const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.value), 0);
  const mrr = computeMrr(contracts);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Business</p>
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </div>

      <ModuleTabs tabs={BUSINESS_TABS} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Open Pipeline" value={money(openValue)} delta={`${openDeals.length} deal(s)`} />
        <StatTile label="Won (all time)" value={money(wonValue)} tone="success" delta={`${wonDeals.length} deal(s)`} />
        <StatTile label="Win Rate" value={`${winRate}%`} delta={`${closedCount} closed`} />
        <StatTile label="MRR" value={money(mrr)} tone="success" />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Pipeline by stage</p>
        <ul className="mt-3 space-y-2">
          {stages.map((stage) => {
            const count = deals.filter((d) => d.stage_id === stage.id).length;
            const value = deals.filter((d) => d.stage_id === stage.id).reduce((s, d) => s + Number(d.value), 0);
            return (
              <li key={stage.id} className="flex items-center justify-between text-sm">
                <span>{stage.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {count} deal(s) · {money(value)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
