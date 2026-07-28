import { createClient } from "@/lib/supabase/server";
import { getPipelineStages, getDeals, getContracts, computeMrr, computePipelineSummary } from "@/lib/db/queries/business";
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

  const summary = computePipelineSummary(deals, stages);
  const mrr = computeMrr(contracts);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Business</p>
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </div>

      <ModuleTabs tabs={BUSINESS_TABS} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Open Pipeline" value={money(summary.openValue)} delta={`${summary.openCount} deal(s)`} />
        <StatTile label="Won (all time)" value={money(summary.wonValue)} tone="success" delta={`${summary.wonCount} deal(s)`} />
        <StatTile label="Win Rate" value={`${summary.winRate}%`} delta={`${summary.closedCount} closed`} />
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
