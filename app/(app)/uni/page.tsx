import Link from "next/link";
import { AlertTriangle, CalendarClock, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getCourses,
  getAssessments,
  getAssessmentGroups,
  getScheduleBlocks,
  getDeadlines,
  getStudySessions,
} from "@/lib/db/queries/uni";
import { courseGrade, semesterAverage, riskScore } from "@/lib/uni/grades";
import { KpiCell, KpiGrid } from "@/components/shared/kpi-grid";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { RiskChip } from "@/components/uni/risk-chip";
import { PlanTonight } from "@/components/uni/plan-tonight";
import { TermOverview } from "@/components/uni/term-overview";
import { StudySessionsCard, type StudySessionRow } from "@/components/uni/study-sessions-card";
import { DueFlashcardsCard } from "@/components/uni/due-flashcards-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { UNI_TABS } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";

export default async function UniDashboardPage() {
  const supabase = await createClient();
  const [courses, deadlines] = await Promise.all([getCourses(supabase), getDeadlines(supabase)]);
  const courseIds = courses.map((c) => c.id);
  const [assessments, groups, scheduleBlocks, studySessions] = await Promise.all([
    getAssessments(supabase, courseIds),
    getAssessmentGroups(supabase, courseIds),
    getScheduleBlocks(supabase, courseIds),
    getStudySessions(supabase, courseIds),
  ]);
  // Study sessions carry only ids, so the card is given the course code and
  // assessment title it needs to be readable — resolved here, where both
  // lists are already in hand, rather than with another round trip.
  const assessmentTitleById = new Map(assessments.map((a) => [a.id, a.title]));
  const courseCodeById = new Map(courses.map((c) => [c.id, c.code]));
  const studySessionRows: StudySessionRow[] = studySessions.map((s) => ({
    ...s,
    courseCode: courseCodeById.get(s.course_id) ?? "Course",
    assessmentTitle: s.assessment_id ? (assessmentTitleById.get(s.assessment_id) ?? null) : null,
  }));

  const groupsByCourse = new Map<string, typeof groups>();
  for (const g of groups) {
    const list = groupsByCourse.get(g.course_id) ?? [];
    list.push(g);
    groupsByCourse.set(g.course_id, list);
  }

  const now = new Date();
  const todayDow = now.getDay();
  const todaysClasses = scheduleBlocks
    .filter((b) => b.day_of_week === todayDow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const coursesWithGrades = courses.map((c) => {
    const courseAssessments = assessments.filter((a) => a.course_id === c.id);
    const courseGroups = groupsByCourse.get(c.id) ?? [];
    return {
      ...c,
      grade: courseGrade(courseAssessments, courseGroups),
      risk: riskScore(c, courseAssessments, now, courseGroups),
      assessmentCount: courseAssessments.length,
      needsVerificationCount: courseAssessments.filter((a) => a.needs_verification).length,
    };
  });
  const average = semesterAverage(coursesWithGrades);
  const coursesWithData = coursesWithGrades.filter((c) => c.assessmentCount > 0).length;
  const coursesWithoutData = coursesWithGrades.filter((c) => c.assessmentCount === 0).map((c) => c.code);

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
      <PageHeader eyebrow="University" title="Dashboard" />

      <ModuleTabs tabs={UNI_TABS} />

      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Add your courses to start tracking grades, deadlines, and schedule."
          icon={GraduationCap}
          action={
            <Link href="/uni/courses" className="text-body font-medium text-brand hover:underline">
              Add a course →
            </Link>
          }
        />
      ) : (
        <>
          {/* The single most urgent thing, given its own band above the
              grid. An overdue assessment is a different kind of fact from
              the counts below it, so it gets the destructive treatment; the
              nearest upcoming item gets a neutral one, because "your next
              deadline" is information, not an alarm. */}
          {mostImportant && mostImportantCourse ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Overdue — deal with this first</AlertTitle>
              <AlertDescription>
                {mostImportantCourse.code} — {mostImportant.title}
              </AlertDescription>
            </Alert>
          ) : nextThing ? (
            <Alert>
              <CalendarClock />
              <AlertTitle>Next up</AlertTitle>
              <AlertDescription>
                {nextThing.courseCode ? `${nextThing.courseCode} — ` : ""}
                {nextThing.title} · due{" "}
                {new Date(nextThing.due_at).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </AlertDescription>
            </Alert>
          ) : null}

          <KpiGrid columns={4}>
            <KpiCell
              label="Semester average"
              icon={GraduationCap}
              primary
              value={average != null ? `${average.toFixed(1)}%` : "—"}
              hint={
                average == null
                  ? "No graded assessments yet"
                  : coursesWithData < courses.length
                    ? `${coursesWithData} of ${courses.length} courses — ${coursesWithoutData.join(", ")} not recorded`
                    : `Across all ${courses.length} courses`
              }
            />
            <KpiCell label="Courses" value={String(courses.length)} hint="This semester" />
            <KpiCell
              label="Overdue"
              value={String(overdue.length)}
              hint={overdue.length === 0 ? "Nothing past due" : "Needs attention now"}
              valueClassName={overdue.length > 0 ? "text-danger" : undefined}
            />
            <KpiCell
              label="Due in 7 days"
              value={String(next7Days.length)}
              hint={next7Days.length === 0 ? "Clear week ahead" : "Assessments and deadlines"}
            />
          </KpiGrid>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <Card padding="slotted">
              <CardHeader>
                <CardTitle>Today&apos;s classes</CardTitle>
              </CardHeader>
              <CardContent>
                {todaysClasses.length === 0 ? (
                  <p className="py-6 text-center text-body text-muted-foreground">No classes today.</p>
                ) : (
                  <ul className="-my-1 divide-y divide-border">
                    {todaysClasses.map((b) => {
                      const course = courses.find((c) => c.id === b.course_id);
                      return (
                        <li key={b.id} className="flex items-center gap-2.5 py-2.5 text-body">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: course?.color ?? "var(--brand)" }}
                          />
                          <span className="tabular shrink-0 text-caption text-muted-foreground">
                            {b.start_time.slice(0, 5)}
                          </span>
                          <span className="font-medium">{course?.code}</span>
                          <span className="text-caption text-muted-foreground capitalize">
                            {b.type.replace("_", " ")}
                          </span>
                          {b.room ? <span className="text-caption text-muted-foreground">· {b.room}</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card padding="slotted">
              <CardHeader>
                <CardTitle>Next 7 days</CardTitle>
              </CardHeader>
              <CardContent>
                {next7Days.length === 0 ? (
                  <p className="py-6 text-center text-body text-muted-foreground">Nothing due.</p>
                ) : (
                  <ul className="-my-1 divide-y divide-border">
                    {next7Days.slice(0, 8).map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-body">
                        <span className="min-w-0 truncate">
                          {item.courseCode ? (
                            <span className="text-muted-foreground">{item.courseCode} · </span>
                          ) : null}
                          {item.title}
                        </span>
                        <span className="shrink-0 text-caption text-muted-foreground">
                          {new Date(item.due_at).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <TermOverview courses={courses} />

          {/* Plan, then the plan. These sat unpaired: PlanTonight wrote rows
              into uni_study_sessions and nothing in the app ever read them
              back, so a saved plan vanished the moment it was saved. */}
          <div className="space-y-4">
            <PlanTonight assessmentCourseIds={Object.fromEntries(assessments.map((a) => [a.id, a.course_id]))} />
            <StudySessionsCard sessions={studySessionRows} />
            {/* The other half of the same loop: reviewing a flashcard has
                always pushed its next_review out, and nothing ever read that
                schedule back. */}
            <DueFlashcardsCard />
          </div>

          <div className="space-y-3">
            <SectionHeader title="Courses" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {coursesWithGrades.map((c) => (
                <Link
                  key={c.id}
                  href={`/uni/courses/${c.id}`}
                  className="block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Card interactive padding="compact">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color ?? "var(--brand)" }}
                        />
                        <span className="truncate text-body font-medium">{c.code}</span>
                      </div>
                      <RiskChip score={c.risk} />
                    </div>
                    <p
                      className={cn(
                        "tabular mt-2 text-metric",
                        c.assessmentCount === 0 && "text-body font-normal text-muted-foreground",
                      )}
                    >
                      {c.assessmentCount === 0
                        ? "No assessments"
                        : c.grade != null
                          ? `${c.grade.toFixed(1)}%`
                          : "—"}
                    </p>
                    {c.needsVerificationCount > 0 ? (
                      <p className="mt-1.5 flex items-center gap-1 text-caption text-warn">
                        <AlertTriangle className="size-3" strokeWidth={2.5} />
                        {c.needsVerificationCount} need{c.needsVerificationCount === 1 ? "s" : ""} verification
                      </p>
                    ) : null}
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
