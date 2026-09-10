import { Briefcase, Trophy, Target, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPipelineStages, getDeals, getContracts, getContacts, computeMrr, computePipelineSummary } from "@/lib/db/queries/business";
import { KpiCell, KpiGrid } from "@/components/shared/kpi-grid";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { PipelineDonutCard } from "@/components/business/pipeline-donut-card";
import { DealsSparklineCard } from "@/components/business/deals-sparkline-card";
import { LatestDealCard } from "@/components/business/latest-deal-card";
import { DealAgingCard, computeDealAging } from "@/components/business/deal-aging-card";
import { BUSINESS_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";

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
  // Reset to local midnight before the day-walk — cursor otherwise keeps
  // whatever time-of-day "now" happened to be, and toISOString() rolls
  // that into the next calendar date once the local time-of-day plus the
  // runtime's UTC offset crosses midnight (same bug found and fixed in
  // uni-calendar.tsx and workout-calendar.tsx — a runtime-timezone-
  // dependent landmine either way, so worth closing here regardless of
  // what timezone this specific process happens to run in today).
  cursor.setHours(0, 0, 0, 0);
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
      <PageHeader eyebrow="Business" title="Dashboard" />

      <ModuleTabs tabs={BUSINESS_TABS} />

      {/* One fused block, like Home, Finance and University — four separate
          cards here sized to their own content, so a two-line label made one
          tile taller than its neighbours and the row read as ragged. */}
      <KpiGrid columns={4}>
        <KpiCell
          label="Open pipeline"
          icon={Briefcase}
          primary
          value={money(summary.openValue)}
          hint={
            summary.openValue === 0 && summary.openCount > 0
              ? `${summary.openCount} deal(s) — values not set yet`
              : `${summary.openCount} open deal(s)`
          }
          valueClassName={summary.openValue === 0 && summary.openCount > 0 ? "text-foreground-tertiary/60" : undefined}
        />
        <KpiCell label="Won (all time)" icon={Trophy} value={money(summary.wonValue)} hint={`${summary.wonCount} deal(s) closed won`} />
        <KpiCell label="Win rate" icon={Target} value={`${summary.winRate}%`} hint={`${summary.closedCount} closed`} />
        <KpiCell label="MRR" icon={TrendingUp} value={money(mrr)} hint="From active contracts" />
      </KpiGrid>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <DealAgingCard openDealCount={openDeals.length} buckets={dealAgingBuckets} />
        <PipelineDonutCard stages={stages} deals={deals} />
        <DealsSparklineCard points={dealsPerDay} />
        <LatestDealCard deal={latestDeal} contact={latestDealContact} stage={latestDealStage} />
      </div>
    </div>
  );
}
