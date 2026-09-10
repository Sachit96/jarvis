import { CandlestickChart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTrades, computeTradeStats } from "@/lib/db/queries/finance";
import { getChecklistItems } from "@/lib/db/queries/trading";
import { ensureDefaultChecklistAction } from "@/actions/trading-actions";
import { TradeForm } from "@/components/finance/trade-form";
import { TradeItem } from "@/components/finance/trade-item";
import { TradeStats } from "@/components/finance/trade-stats";
import { PositionSizeCalculator } from "@/components/finance/position-size-calculator";
import { ChecklistManager } from "@/components/finance/checklist-manager";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { FINANCE_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default async function TradesPage() {
  await ensureDefaultChecklistAction();

  const supabase = await createClient();
  const [trades, checklistItems] = await Promise.all([getTrades(supabase), getChecklistItems(supabase)]);
  const stats = computeTradeStats(trades);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Trading &amp; Venture Journal"
        actions={<TradeForm checklistItems={checklistItems} />}
      />

      <ModuleTabs tabs={FINANCE_TABS} />

      <TradeStats {...stats} />

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <PositionSizeCalculator />
        <ChecklistManager items={checklistItems} />
      </div>

      {trades.length === 0 ? (
        <div className="surface">
          <EmptyState icon={CandlestickChart} title="No trades logged" description="Log a trade above to start tracking win rate and running P&L." />
        </div>
      ) : (
        <ul className="space-y-2">
          {trades.map((trade) => (
            <TradeItem key={trade.id} trade={trade} />
          ))}
        </ul>
      )}
    </div>
  );
}
