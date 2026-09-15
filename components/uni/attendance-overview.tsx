import { ProgressRing } from "@/components/shared/progress-ring";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  summarise, summariseByCourse, ATTENDANCE_THRESHOLD,
  type AttendanceRecord, type AttendanceRisk,
} from "@/lib/uni/attendance";

export interface AttendanceCourse {
  id: string;
  code: string;
  name: string;
}

/**
 * Attendance as rings — overall, then per course worst-first.
 *
 * A server component: nothing here changes while the page is open, so making
 * it a client component would ship the arithmetic to the browser for no gain.
 *
 * Colour is never the only signal. Every ring carries the percentage as text
 * and a worded risk label, so the at-risk state survives a colour-vision
 * difference and a greyscale screenshot alike.
 */

const RISK_TEXT: Record<AttendanceRisk, string> = {
  good: "On track",
  warning: "Close to the line",
  at_risk: "Below requirement",
  no_data: "Nothing recorded",
};

const RISK_RING: Record<AttendanceRisk, string> = {
  good: "stroke-success",
  warning: "stroke-warn",
  at_risk: "stroke-danger",
  no_data: "stroke-muted-foreground/40",
};

const RISK_TEXT_CLASS: Record<AttendanceRisk, string> = {
  good: "text-success",
  warning: "text-warn",
  at_risk: "text-danger",
  no_data: "text-muted-foreground",
};

export function AttendanceOverview({
  records,
  courses,
}: {
  records: AttendanceRecord[];
  courses: AttendanceCourse[];
}) {
  const overall = summarise(records);
  const byCourse = summariseByCourse(records);
  const courseById = new Map(courses.map((c) => [c.id, c]));

  if (records.length === 0) {
    return (
      <Card padding="slotted">
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
          <CardDescription>
            Nothing recorded yet. Mark a class present or absent and the rings fill in here — no
            integration or import required.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card padding="slotted">
        <CardHeader>
          <CardTitle>Overall attendance</CardTitle>
          <CardDescription>
            {ATTENDANCE_THRESHOLD}% is the usual requirement. Cancelled and excused classes are
            left out of the calculation rather than counted against you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          <ProgressRing
            percent={overall.percent ?? 0}
            size={128}
            strokeWidth={10}
            label={overall.percent === null ? "—" : `${overall.percent}%`}
            sublabel={`${overall.attended}/${overall.counted}`}
            colorClassName={RISK_RING[overall.risk]}
          />
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <Stat label="Attended" value={overall.attended} />
            <Stat label="Missed" value={overall.missed} tone={overall.missed > 0 ? "danger" : undefined} />
            <Stat label="Late" value={overall.late} />
            <Stat label="Excused" value={overall.excused} />
            <Stat label="Cancelled" value={overall.cancelled} />
            <div>
              <dt className="text-caption text-muted-foreground">Status</dt>
              <dd className={cn("text-body font-medium", RISK_TEXT_CLASS[overall.risk])}>
                {RISK_TEXT[overall.risk]}
              </dd>
            </div>
          </dl>
        </CardContent>
        {overall.percent !== null ? (
          <CardContent className="pt-0">
            <p className="text-caption text-muted-foreground">
              {overall.canMiss === 0
                ? `Already below ${ATTENDANCE_THRESHOLD}% — every further absence widens the gap.`
                : `You can miss ${overall.canMiss} more class${overall.canMiss === 1 ? "" : "es"} and stay at or above ${ATTENDANCE_THRESHOLD}%.`}
            </p>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {byCourse.map((course) => {
          const meta = courseById.get(course.courseId);
          return (
            <Card key={course.courseId} padding="slotted">
              <CardHeader>
                <CardTitle className="text-body">{meta?.code ?? "Course"}</CardTitle>
                <CardDescription className="truncate">{meta?.name ?? ""}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <ProgressRing
                  percent={course.percent ?? 0}
                  size={84}
                  strokeWidth={8}
                  label={course.percent === null ? "—" : `${course.percent}%`}
                  colorClassName={RISK_RING[course.risk]}
                />
                <div className="min-w-0 space-y-1">
                  <p className={cn("text-label font-medium", RISK_TEXT_CLASS[course.risk])}>
                    {RISK_TEXT[course.risk]}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {course.attended} attended · {course.missed} missed
                  </p>
                  {course.percent !== null ? (
                    <p className="text-caption text-muted-foreground/80">
                      {course.canMiss === 0 ? "No room left" : `${course.canMiss} to spare`}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className={cn("text-body font-medium tabular", tone === "danger" ? "text-danger" : undefined)}>
        {value}
      </dd>
    </div>
  );
}
