import { createClient } from "@/lib/supabase/server";
import { getPrayers, getPrayerLogsForDate } from "@/lib/db/queries/life";
import { ensureDefaultPrayersAction } from "@/actions/life-actions";
import { PrayerChecklist } from "@/components/life/prayer-checklist";
import { PrayerForm } from "@/components/life/prayer-form";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function PrayerPage() {
  await ensureDefaultPrayersAction();

  const supabase = await createClient();
  const prayers = await getPrayers(supabase);
  const logs = await getPrayerLogsForDate(supabase, todayStr());
  const completedIds = logs.filter((l) => l.completed).map((l) => l.prayer_id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Life</p>
        <h1 className="text-xl font-semibold">Prayer</h1>
      </div>

      <PrayerChecklist prayers={prayers} completedIds={completedIds} />
      <PrayerForm />
    </div>
  );
}
