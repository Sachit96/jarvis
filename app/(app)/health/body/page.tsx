import { createClient } from "@/lib/supabase/server";
import { getBodyMetrics, getSleepLogs } from "@/lib/db/queries/health";
import { WeightForm } from "@/components/health/weight-form";
import { WeightTrendCard } from "@/components/health/weight-trend-card";
import { SleepForm } from "@/components/health/sleep-form";
import { SleepTrendCard } from "@/components/health/sleep-trend-card";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { HEALTH_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";

export default async function BodyPage() {
  const supabase = await createClient();
  const [bodyMetrics, sleepLogs] = await Promise.all([getBodyMetrics(supabase), getSleepLogs(supabase)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageHeader eyebrow="Health" title="Body" />
        <div className="flex gap-2">
          <WeightForm />
          <SleepForm />
        </div>
      </div>

      <ModuleTabs tabs={HEALTH_TABS} />

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <WeightTrendCard entries={bodyMetrics} />
        <SleepTrendCard entries={sleepLogs} />
      </div>
    </div>
  );
}
