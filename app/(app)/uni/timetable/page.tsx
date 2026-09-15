import { createClient } from "@/lib/supabase/server";
import { getCourses, getScheduleBlocks, getNoClassPeriods } from "@/lib/db/queries/uni";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { PageHeader } from "@/components/shared/page-header";
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
  const [blocks, noClassPeriods] = await Promise.all([
    getScheduleBlocks(supabase, courses.map((c) => c.id)),
    getNoClassPeriods(supabase),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="University" title="Timetable" />

      <ModuleTabs tabs={UNI_TABS} />

      <WeeklyTimetable
        blocks={blocks}
        courses={courses.map((c) => ({ id: c.id, code: c.code, name: c.name, color: c.color }))}
        noClassPeriods={noClassPeriods}
        courseTerms={courses.map((c) => ({ id: c.id, term_start: c.term_start, term_end: c.term_end }))}
      />
    </div>
  );
}
