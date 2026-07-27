import { createClient } from "@/lib/supabase/server";
import { getMarketAnalyses } from "@/lib/db/queries/trading";
import { MarketAnalysisForm } from "@/components/finance/market-analysis-form";
import { MarketAnalysisCard } from "@/components/finance/market-analysis-card";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { FINANCE_TABS } from "@/lib/nav-items";

export default async function MarketAnalysisPage() {
  const supabase = await createClient();
  const analyses = await getMarketAnalyses(supabase);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Finance</p>
          <h1 className="text-xl font-semibold">Top-Down Analysis</h1>
        </div>
        <MarketAnalysisForm />
      </div>

      <ModuleTabs tabs={FINANCE_TABS} />

      <p className="text-sm text-muted-foreground">
        Track market structure across Weekly, Daily, and 4H timeframes before you trade.
      </p>

      {analyses.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No analyses logged yet — add your first pair above.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {analyses.map((analysis) => (
            <MarketAnalysisCard key={analysis.id} analysis={analysis} />
          ))}
        </div>
      )}
    </div>
  );
}
