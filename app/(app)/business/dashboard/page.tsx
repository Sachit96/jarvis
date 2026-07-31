import { Briefcase, Trophy, Target, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPipelineStages, getDeals, getContracts, getContacts, computeMrr, computePipelineSummary } from "@/lib/db/queries/business";
import { StatTile } from "@/components/shared/stat-tile";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { PipelineDonutCard } from "@/components/business/pipeline-donut-card";
import { DealsSparklineCard } from "@/components/business/deals-sparkline-card";
import { LatestDealCard } from "@/components/business/latest-deal-card";
import { DealAgingCard, computeDealAging } from "@/components/business/deal-aging-card";
import { BUSINESS_TABS } from "@/lib/nav-items";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const SPARKLINE_DAYS = 14;

/** Deals created per day, zero-filled — derived entirely from already-fetched deal rows, no new query. */
function computeDealsPerDay(deals: { created_at: string }[], days = SPARKLINE_DAYS) {
  const byDay = new Map<string, number>();
  for (const d of deals) {
    const key = d.created_at.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const points: { date: string; count: number }[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - days + 1);
  for (let i = 0; i < days; i++) {
    const key = cursor.toISOString().slice(0, 10);
    points.push({ date: key, count: byDay.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

export default async function BusinessDashboardPage() {
  const supabase = await createClient();
  const [stages, deals, contracts, contacts] = await Promise.all([
    getPipelineStages(supabase),
    getDeals(supabase),
    getContracts(supabase),
    getContacts(supabase),
  ]);

  const summary = computePipelineSummary(deals, stages);
  const mrr = computeMrr(contracts);
  const dealsPerDay = computeDealsPerDay(deals);

  const latestDeal = deals.length > 0 ? deals[0] : null; // getDeals already orders by created_at desc
  const latestDealContact = latestDeal ? (contacts.find((c) => c.id === latestDeal.contact_id) ?? null) : null;
  const latestDealStage = latestDeal ? (stages.find((s) => s.id === latestDeal.stage_id) ?? null) : null;

  const closedStageIds = new Set(stages.filter((s) => s.is_won || s.is_lost).map((s) => s.id));
  const openDeals = deals.filter((d) => !closedStageIds.has(d.stage_id));
  const dealAgingBuckets = computeDealAging(openDeals);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Business</p>
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </div>

      <ModuleTabs tabs={BUSINESS_TABS} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Open Pipeline" value={money(summary.openValue)} delta={`${summary.openCount} deal(s)`} icon={Briefcase} category="business" />
        <StatTile label="Won (all time)" value={money(summary.wonValue)} tone="success" delta={`${summary.wonCount} deal(s)`} icon={Trophy} category="business" />
        <StatTile label="Win Rate" value={`${summary.winRate}%`} delta={`${summary.closedCount} closed`} icon={Target} category="business" />
        <StatTile label="MRR" value={money(mrr)} tone="success" icon={TrendingUp} category="business" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <DealAgingCard openDealCount={openDeals.length} buckets={dealAgingBuckets} />
        <PipelineDonutCard stages={stages} deals={deals} />
        <DealsSparklineCard points={dealsPerDay} />
        <LatestDealCard deal={latestDeal} contact={latestDealContact} stage={latestDealStage} />
      </div>
    </div>
  );
}
