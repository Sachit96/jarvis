import { createClient } from "@/lib/supabase/server";
import { getCourses, getAssessments, getDeadlines, getScheduleBlocks } from "@/lib/db/queries/uni";
import { expandWeeklyOccurrences } from "@/lib/uni/schedule-occurrences";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { Card } from "@/components/ui/card";
import { UniCalendar, type CalendarItem } from "@/components/uni/uni-calendar";
import { UNI_TABS } from "@/lib/nav-items";

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")}${period}`;
}

const SCHEDULE_TYPE_LABEL: Record<string, string> = {
  lecture: "Lecture",
  tutorial: "Tutorial",
  lab: "Lab",
  office_hours: "Office Hours",
};

export default async function UniCalendarPage() {
  const supabase = await createClient();
  const [courses, deadlines] = await Promise.all([getCourses(supabase), getDeadlines(supabase)]);
  const courseIds = courses.map((c) => c.id);
  const [assessments, scheduleBlocks] = await Promise.all([getAssessments(supabase, courseIds), getScheduleBlocks(supabase, courseIds)]);

  // Recurring weekly classes have no due_at of their own (see
  // schedule-occurrences.ts's own comment) — projected across a wide
  // window centered on today so month navigation in either direction
  // still shows real class times, then clamped per-course below to when
  // that course's own term actually runs.
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 6, 0);
  const courseById = new Map(courses.map((c) => [c.id, c]));

  /**
   * Found live (2026-09-05, the morning after seeding Fall 2026): MKT 100
   * showed up on the calendar meeting Saturday Sept 5 — three days before
   * the real Sept 8 term start. The wide window above has nothing clamping
   * it to when a course's term actually runs, because uni_courses never
   * had a real date range before migration 0032 (term_start/term_end,
   * nullable). Filtered here rather than by narrowing the window itself,
   * since each course can have its own term dates — a single global
   * window can't clamp per-course.
   *
   * Degrades to "show everything in the wide window" (today's behavior,
   * unclamped) for any course whose term_start/term_end isn't set yet —
   * true for every course until 0032 is applied AND real dates are filled
   * in, not an error state. Once both exist for a course, occurrences
   * outside [term_start, term_end] are dropped. Plain string comparison
   * is correct here — both are "YYYY-MM-DD", which sorts chronologically
   * as text.
   */
  const classOccurrences = expandWeeklyOccurrences(scheduleBlocks, rangeStart, rangeEnd).filter(({ date, item: block }) => {
    const course = courseById.get(block.course_id);
    if (!course?.term_start || !course?.term_end) return true;
    return date >= course.term_start && date <= course.term_end;
  });

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
    ...classOccurrences.map(({ date, item: block }): CalendarItem => {
      const course = courses.find((c) => c.id === block.course_id);
      return {
        id: `c-${block.id}-${date}`,
        title: `${course?.code ?? ""} — ${SCHEDULE_TYPE_LABEL[block.type] ?? block.type}`,
        due_at: `${date}T${block.start_time}`,
        color: course?.color ?? "#8b5cf6",
        sublabel: `${formatTime(block.start_time)}–${formatTime(block.end_time)}${block.room ? ` · ${block.room}` : ""}`,
      };
    }),
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
