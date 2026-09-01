import { createClient } from "@/lib/supabase/server";
import { getCourses, getAssessments, getDeadlines } from "@/lib/db/queries/uni";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { Card } from "@/components/ui/card";
import { UniCalendar, type CalendarItem } from "@/components/uni/uni-calendar";
import { UNI_TABS } from "@/lib/nav-items";

export default async function UniCalendarPage() {
  const supabase = await createClient();
  const [courses, deadlines] = await Promise.all([getCourses(supabase), getDeadlines(supabase)]);
  const assessments = await getAssessments(supabase, courses.map((c) => c.id));

  const items: CalendarItem[] = [
    ...assessments
      .filter((a) => a.due_at)
      .map((a): CalendarItem => {
        const course = courses.find((c) => c.id === a.course_id);
        return {
          id: `a-${a.id}`,
          title: `${course?.code ?? ""} — ${a.title}`,
          due_at: a.due_at!,
          color: course?.color ?? "#8b5cf6",
          sublabel: `${a.weight_pct}%`,
        };
      }),
    ...deadlines.map((d): CalendarItem => ({ id: `d-${d.id}`, title: d.title, due_at: d.due_at, color: "#f97316", sublabel: d.category })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">University</p>
        <h1 className="text-xl font-semibold">Calendar</h1>
      </div>

      <ModuleTabs tabs={UNI_TABS} />

      <Card>
        <UniCalendar items={items} />
      </Card>
    </div>
  );
}
