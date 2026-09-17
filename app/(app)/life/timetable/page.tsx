import { createClient } from "@/lib/supabase/server";
import { getWeekSchedule } from "@/lib/db/queries/life-schedule";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { LifeWeeklyTimetable } from "@/components/life/weekly-timetable";
import { LifeScheduleBlockForm } from "@/components/life/schedule-block-form";
import { RoutineList } from "@/components/life/routine-list";
import { TASKS_TABS } from "@/lib/nav-items";

/**
 * The Life OS Timetable: the standing weekly routine (self-care, commute,
 * On Radar work, gym, meals, personal time) plus class times pulled in
 * from University, merged into one week view.
 *
 * A new page under /life rather than folding this into University's own
 * /uni/timetable — that page answers "where do class blocks put me", this
 * one answers "what does my whole week look like", and the user asked for
 * it as its own "Life OS Timetable" rather than a University feature.
 * Class times still live in one place (uni_schedule_blocks); this page
 * only reads them in, via getWeekSchedule, so there's no second source of
 * truth to drift out of sync.
 */
export default async function LifeTimetablePage() {
  const supabase = await createClient();
  const blocks = await getWeekSchedule(supabase);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Life" title="Timetable" actions={<LifeScheduleBlockForm />} />

      <ModuleTabs tabs={TASKS_TABS} />

      <LifeWeeklyTimetable blocks={blocks} />

      <RoutineList blocks={blocks} />
    </div>
  );
}
