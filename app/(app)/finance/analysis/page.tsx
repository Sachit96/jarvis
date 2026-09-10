import { LineChart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMarketAnalyses } from "@/lib/db/queries/trading";
import { MarketAnalysisForm } from "@/components/finance/market-analysis-form";
import { MarketAnalysisCard } from "@/components/finance/market-analysis-card";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { FINANCE_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default async function MarketAnalysisPage() {
  const supabase = await createClient();
  const analyses = await getMarketAnalyses(supabase);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Top-Down Analysis"
        actions={<MarketAnalysisForm />}
      />

      <ModuleTabs tabs={FINANCE_TABS} />

      <p className="text-sm text-muted-foreground">
        Track market structure across Weekly, Daily, and 4H timeframes before you trade.
      </p>

      {analyses.length === 0 ? (
        <div className="surface">
          <EmptyState icon={LineChart} title="No analyses yet" description="Add a pair above to keep a running read on the setups you are watching." />
        </div>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {analyses.map((analysis) => (
            <MarketAnalysisCard key={analysis.id} analysis={analysis} />
          ))}
        </div>
      )}
    </div>
  );
}
