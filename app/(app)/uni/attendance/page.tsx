import { UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCourses, getAttendance } from "@/lib/db/queries/uni";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { AttendanceOverview } from "@/components/uni/attendance-overview";
import { UNI_TABS } from "@/lib/nav-items";
import type { AttendanceRecord } from "@/lib/uni/attendance";

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
  const records = await getAttendance(supabase, courses.map((c) => c.id));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">University</p>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <UserCheck className="size-5 text-cat-goals" strokeWidth={2} />
          Attendance
        </h1>
      </div>

      <ModuleTabs tabs={UNI_TABS} />

      <AttendanceOverview
        records={records as AttendanceRecord[]}
        courses={courses.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
      />
    </div>
  );
}
