import { notFound } from "next/navigation";
import { BookOpen, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCourse, getAssessments, getAssessmentGroups, getScheduleBlocks, getMaterials } from "@/lib/db/queries/uni";
import { courseGrade, neededOnRemaining, bestCase, worstCase, riskScore, unresolvedWeightCount } from "@/lib/uni/grades";
import { StatTile } from "@/components/shared/stat-tile";
import { RiskChip } from "@/components/uni/risk-chip";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseForm } from "@/components/uni/course-form";
import { AssessmentForm } from "@/components/uni/assessment-form";
import { AssessmentItem } from "@/components/uni/assessment-item";
import { ScheduleBlockForm } from "@/components/uni/schedule-block-form";
import { MaterialForm } from "@/components/uni/material-form";
import { SyllabusUpload } from "@/components/uni/syllabus-upload";
import { FlashcardStudy } from "@/components/uni/flashcard-study";
import { MaterialQa } from "@/components/uni/material-qa";
import { DeleteScheduleBlockButton, DeleteMaterialButton } from "@/components/uni/uni-delete-buttons";
import { Backlinks } from "@/components/shared/backlinks";
import { getBacklinks } from "@/lib/obsidian/wikilinks";
import { EmptyState } from "@/components/shared/empty-state";
import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";

const DAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const course = await getCourse(supabase, id);
  if (!course) notFound();

  const [assessments, groups, scheduleBlocks, materials, backlinks] = await Promise.all([
    getAssessments(supabase, [id]),
    getAssessmentGroups(supabase, [id]),
    getScheduleBlocks(supabase, [id]),
    getMaterials(supabase, id),
    getBacklinks(supabase, "uni_course", id),
  ]);

  const grade = courseGrade(assessments, groups);
  const risk = riskScore(course, assessments, new Date(), groups);
  const needed = course.target_grade != null ? neededOnRemaining(assessments, course.target_grade, groups) : null;
  const best = bestCase(assessments, groups);
  const worst = worstCase(assessments, groups);
  const unresolvedWeight = unresolvedWeightCount(assessments);

  const sortedBlocks = [...scheduleBlocks].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  return (
    <div className="space-y-6">
      <BackLink href="/uni/courses" label="Courses" />

      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: course.color ?? "var(--brand)" }}
            />
            {course.term}
          </span>
        }
        title={`${course.code} — ${course.name}`}
        description={
          course.professor
            ? [course.professor, course.professor_email, course.room].filter(Boolean).join(" · ")
            : undefined
        }
        actions={
          <>
            <RiskChip score={risk} />
            <SyllabusUpload courseId={course.id} />
            <CourseForm course={course} />
          </>
        }
      />

      <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-4">
        <StatTile
          label="Current Grade"
          value={assessments.length === 0 ? "No assessments recorded" : grade != null ? `${grade.toFixed(1)}%` : "—"}
          unmeasured={assessments.length === 0}
          note={unresolvedWeight > 0 ? `${unresolvedWeight} assessment${unresolvedWeight > 1 ? "s" : ""} with unresolved weight — projections incomplete` : undefined}
          primary
        />
        <StatTile label="Target" value={course.target_grade != null ? `${course.target_grade}%` : "Not set"} />
        {needed && !needed.noData ? (
          <StatTile
            label="Needed on Remaining"
            value={needed.locked ? (needed.possible ? "Locked in" : "Missed") : `${needed.requiredAvgPct.toFixed(1)}%`}
            tone={needed.possible ? "success" : "danger"}
          />
        ) : needed?.noData ? (
          <StatTile label="Needed on Remaining" value="No assessments recorded" unmeasured />
        ) : (
          <StatTile label="Needed on Remaining" value="Set a target" />
        )}
        <StatTile label="Best / Worst Case" value={assessments.length === 0 ? "—" : `${best.toFixed(0)}% / ${worst.toFixed(0)}%`} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <p className="eyebrow">Schedule</p>
            <ScheduleBlockForm courseId={course.id} />
          </div>
          {sortedBlocks.length === 0 ? (
            <p className="mt-3 text-body text-foreground-tertiary">No class times added</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sortedBlocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {DAY_LABEL[b.day_of_week]} {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                    <span className="ml-2 text-caption capitalize text-muted-foreground">{b.type.replace("_", " ")}</span>
                    {b.room ? <span className="ml-1 text-caption text-muted-foreground">· {b.room}</span> : null}
                  </span>
                  <DeleteScheduleBlockButton id={b.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="eyebrow">Materials</p>
            <div className="flex items-center gap-2">
              <MaterialQa courseId={course.id} hasMaterials={materials.length > 0} />
              <MaterialForm courseId={course.id} />
            </div>
          </div>
          {materials.length === 0 ? (
            <p className="mt-3 text-body text-foreground-tertiary">No materials uploaded</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {materials.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-foreground">{m.title}</span>
                    <Badge variant="outline" className="shrink-0 capitalize">{m.type.replace("_", " ")}</Badge>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <FlashcardStudy materialId={m.id} courseId={course.id} />
                    <DeleteMaterialButton id={m.id} courseId={course.id} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow">Assessments</p>
          <AssessmentForm courseId={course.id} />
        </div>
        {assessments.length === 0 ? (
          <div className="surface">
            <EmptyState
              icon={BookOpen}
              title="No assessments yet"
              description="Assignments and exams added to this course will be listed here with their weightings."
            />
          </div>
        ) : (
          <div className="space-y-2">
            {assessments.map((a) => (
              <AssessmentItem key={a.id} assessment={a} courseColor={course.color ?? undefined} />
            ))}
          </div>
        )}
      </div>

      <Backlinks backlinks={backlinks} />
    </div>
  );
}
