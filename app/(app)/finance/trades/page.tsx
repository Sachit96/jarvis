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

export default async function TradesPage() {
  await ensureDefaultChecklistAction();

  const supabase = await createClient();
  const [trades, checklistItems] = await Promise.all([getTrades(supabase), getChecklistItems(supabase)]);
  const stats = computeTradeStats(trades);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Finance</p>
          <h1 className="text-xl font-semibold">Trading &amp; Venture Journal</h1>
        </div>
        <TradeForm checklistItems={checklistItems} />
      </div>

      <ModuleTabs tabs={FINANCE_TABS} />

      <TradeStats {...stats} />

      <div className="grid gap-4 sm:grid-cols-2">
        <PositionSizeCalculator />
        <ChecklistManager items={checklistItems} />
      </div>

      {trades.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No trades logged yet — add your first one above.
        </p>
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
