import { CalendarRange } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCourses, getScheduleBlocks } from "@/lib/db/queries/uni";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { WeeklyTimetable } from "@/components/uni/weekly-timetable";
import { UNI_TABS } from "@/lib/nav-items";

/**
 * The week, from the schedule blocks that already exist on each course.
 *
 * Deliberately not another calendar: /uni/calendar answers "what is due
 * this month" (assessments and deadlines, each with a real date), whereas
 * this answers "where do I need to be" — recurring blocks with no date of
 * their own. Same data model, different question.
 */
export default async function UniTimetablePage() {
  const supabase = await createClient();
  const courses = await getCourses(supabase);
  const blocks = await getScheduleBlocks(supabase, courses.map((c) => c.id));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">University</p>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <CalendarRange className="size-5 text-cat-goals" strokeWidth={2} />
          Timetable
        </h1>
      </div>

      <ModuleTabs tabs={UNI_TABS} />

      <WeeklyTimetable
        blocks={blocks}
        courses={courses.map((c) => ({ id: c.id, code: c.code, name: c.name, color: c.color }))}
      />
    </div>
  );
}
