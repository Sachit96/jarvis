import Link from "next/link";
import { AlertTriangle, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCourses, getAssessments, getScheduleBlocks, getDeadlines } from "@/lib/db/queries/uni";
import { courseGrade, semesterAverage, riskScore } from "@/lib/uni/grades";
import { StatTile } from "@/components/shared/stat-tile";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { RiskChip } from "@/components/uni/risk-chip";
import { PlanTonight } from "@/components/uni/plan-tonight";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { UNI_TABS } from "@/lib/nav-items";

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function UniDashboardPage() {
  const supabase = await createClient();
  const [courses, deadlines] = await Promise.all([getCourses(supabase), getDeadlines(supabase)]);
  const courseIds = courses.map((c) => c.id);
  const [assessments, scheduleBlocks] = await Promise.all([
    getAssessments(supabase, courseIds),
    getScheduleBlocks(supabase, courseIds),
  ]);

  const now = new Date();
  const todayDow = now.getDay();
  const todaysClasses = scheduleBlocks
    .filter((b) => b.day_of_week === todayDow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const coursesWithGrades = courses.map((c) => {
    const courseAssessments = assessments.filter((a) => a.course_id === c.id);
    return { ...c, grade: courseGrade(courseAssessments), risk: riskScore(c, courseAssessments), assessmentCount: courseAssessments.length };
  });
  const average = semesterAverage(coursesWithGrades);

  const overdue = assessments.filter((a) => a.due_at && new Date(a.due_at) < now && a.status !== "submitted" && a.status !== "graded");

  const in7Days = new Date(now.getTime() + 7 * 86_400_000);
  const upcomingAssessments = assessments
    .filter((a) => a.due_at && new Date(a.due_at) >= now && new Date(a.due_at) <= in7Days && a.status !== "graded")
    .map((a) => ({ id: a.id, title: a.title, due_at: a.due_at!, kind: "assessment" as const, courseCode: courses.find((c) => c.id === a.course_id)?.code }));
  const upcomingDeadlines = deadlines
    .filter((d) => new Date(d.due_at) >= now && new Date(d.due_at) <= in7Days)
    .map((d) => ({ id: d.id, title: d.title, due_at: d.due_at, kind: "deadline" as const, courseCode: undefined }));
  const next7Days = [...upcomingAssessments, ...upcomingDeadlines].sort((a, b) => a.due_at.localeCompare(b.due_at));

  // "Most important thing right now": worst overdue item wins outright; otherwise the nearest upcoming item, tie-broken by weight for assessments.
  const mostImportant = overdue.length > 0
    ? overdue.sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())[0]
    : null;
  const mostImportantCourse = mostImportant ? courses.find((c) => c.id === mostImportant.course_id) : null;
  const nextThing = next7Days[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">University</p>
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </div>

      <ModuleTabs tabs={UNI_TABS} />

      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Add your courses to start tracking grades, deadlines, and schedule."
          icon={GraduationCap}
          action={
            <Link href="/uni/courses" className="text-sm font-medium text-brand hover:underline">
              Add a course →
            </Link>
          }
        />
      ) : (
        <>
          {mostImportant && mostImportantCourse ? (
            <Card className="border-danger/30 bg-danger/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <div>
                  <p className="text-caption uppercase tracking-wide text-danger">Most important thing right now</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {mostImportantCourse.code} — {mostImportant.title} is overdue
                  </p>
                </div>
              </div>
            </Card>
          ) : nextThing ? (
            <Card>
              <p className="text-caption uppercase tracking-wide text-muted-foreground">Most important thing right now</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {nextThing.courseCode ? `${nextThing.courseCode} — ` : ""}
                {nextThing.title} · due {new Date(nextThing.due_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </Card>
          ) : null}

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Semester Average" value={average != null ? `${average.toFixed(1)}%` : "—"} icon={GraduationCap} category="goals" />
            <StatTile label="Courses" value={String(courses.length)} />
            <StatTile label="Overdue" value={String(overdue.length)} tone={overdue.length > 0 ? "danger" : "neutral"} />
            <StatTile label="Due in 7 Days" value={String(next7Days.length)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <p className="text-caption uppercase tracking-wide text-muted-foreground">Today&apos;s classes</p>
              {todaysClasses.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground/50">No classes today</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {todaysClasses.map((b) => {
                    const course = courses.find((c) => c.id === b.course_id);
                    return (
                      <li key={b.id} className="flex items-center gap-2.5 text-sm">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: course?.color ?? "#8b5cf6" }} />
                        <span className="font-mono text-caption text-muted-foreground">{b.start_time.slice(0, 5)}</span>
                        <span className="text-foreground">{course?.code}</span>
                        <span className="text-caption text-muted-foreground capitalize">{b.type.replace("_", " ")}</span>
                        {b.room ? <span className="text-caption text-muted-foreground">· {b.room}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <p className="text-caption uppercase tracking-wide text-muted-foreground">Next 7 days</p>
              {next7Days.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground/50">Nothing due</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {next7Days.slice(0, 8).map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {item.courseCode ? <span className="text-muted-foreground">{item.courseCode} · </span> : null}
                        {item.title}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {new Date(item.due_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <PlanTonight assessmentCourseIds={Object.fromEntries(assessments.map((a) => [a.id, a.course_id]))} />

          <div>
            <p className="mb-3 text-caption uppercase tracking-wide text-muted-foreground">Courses</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {coursesWithGrades.map((c) => (
                <Link key={c.id} href={`/uni/courses/${c.id}`} className="block outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-2xl">
                  <Card interactive padding="compact">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color ?? "#8b5cf6" }} />
                        <span className="text-sm font-medium text-foreground">{c.code}</span>
                      </div>
                      <RiskChip score={c.risk} />
                    </div>
                    <p className="mt-2 font-mono text-lg tabular-nums text-foreground">{c.grade != null ? `${c.grade.toFixed(1)}%` : "—"}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
