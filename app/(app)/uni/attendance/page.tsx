import { createClient } from "@/lib/supabase/server";
import { getCourses, getAttendance, getScheduleBlocks } from "@/lib/db/queries/uni";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { AttendanceOverview } from "@/components/uni/attendance-overview";
import { AttendanceMarker, type TodayClass } from "@/components/uni/attendance-marker";
import { todayStr } from "@/lib/date";
import { UNI_TABS } from "@/lib/nav-items";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/uni/attendance";

/**
 * Attendance, entirely from JARVIS's own records.
 *
 * No LMS, no import, no credentials: uni_schedule_blocks says when a class
 * happens and uni_attendance says whether you were in it. That is the whole
 * dependency chain, which is why this module works with zero integrations
 * configured.
 */
export default async function UniAttendancePage() {
  const supabase = await createClient();
  const courses = await getCourses(supabase);
  const courseIds = courses.map((c) => c.id);
  // Independent of each other, so one round trip rather than three.
  const [records, blocks] = await Promise.all([
    getAttendance(supabase, courseIds),
    getScheduleBlocks(supabase, courseIds),
  ]);

  const today = todayStr();
  // getDay() on a bare YYYY-MM-DD would read it as UTC midnight and land on
  // the wrong weekday west of UTC — the same trap lib/uni/schedule-occurrences
  // documents. Appending the time forces local interpretation.
  const weekday = new Date(`${today}T00:00:00`).getDay();
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const markedToday = new Map(
    records
      .filter((r) => r.class_date === today && r.schedule_block_id)
      .map((r) => [r.schedule_block_id as string, r.status as AttendanceStatus]),
  );

  const todayClasses: TodayClass[] = blocks
    .filter((b) => b.day_of_week === weekday)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((b) => ({
      scheduleBlockId: b.id,
      courseId: b.course_id,
      courseCode: courseById.get(b.course_id)?.code ?? "Course",
      courseName: courseById.get(b.course_id)?.name ?? "",
      startTime: b.start_time,
      endTime: b.end_time,
      room: b.room,
      status: markedToday.get(b.id) ?? null,
    }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="University" title="Attendance" />

      <ModuleTabs tabs={UNI_TABS} />

      <AttendanceMarker classes={todayClasses} date={today} />

      <AttendanceOverview
        records={records as AttendanceRecord[]}
        courses={courses.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
      />
    </div>
  );
}
