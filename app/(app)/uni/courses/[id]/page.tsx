import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCourse, getAssessments, getScheduleBlocks, getMaterials } from "@/lib/db/queries/uni";
import { courseGrade, neededOnRemaining, bestCase, worstCase, riskScore } from "@/lib/uni/grades";
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

const DAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const course = await getCourse(supabase, id);
  if (!course) notFound();

  const [assessments, scheduleBlocks, materials, backlinks] = await Promise.all([
    getAssessments(supabase, [id]),
    getScheduleBlocks(supabase, [id]),
    getMaterials(supabase, id),
    getBacklinks(supabase, "uni_course", id),
  ]);

  const grade = courseGrade(assessments);
  const risk = riskScore(course, assessments);
  const needed = course.target_grade != null ? neededOnRemaining(assessments, course.target_grade) : null;
  const best = bestCase(assessments);
  const worst = worstCase(assessments);

  const sortedBlocks = [...scheduleBlocks].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: course.color ?? "#8b5cf6" }} />
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{course.term}</p>
          </div>
          <h1 className="text-xl font-semibold">{course.code} — {course.name}</h1>
          {course.professor ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {course.professor}
              {course.professor_email ? ` · ${course.professor_email}` : ""}
              {course.room ? ` · ${course.room}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <RiskChip score={risk} />
          <SyllabusUpload courseId={course.id} />
          <CourseForm course={course} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Current Grade" value={grade != null ? `${grade.toFixed(1)}%` : "—"} primary />
        <StatTile label="Target" value={course.target_grade != null ? `${course.target_grade}%` : "Not set"} />
        {needed ? (
          <StatTile
            label="Needed on Remaining"
            value={needed.locked ? (needed.possible ? "Locked in" : "Missed") : `${needed.requiredAvgPct.toFixed(1)}%`}
            tone={needed.possible ? "success" : "danger"}
          />
        ) : (
          <StatTile label="Needed on Remaining" value="Set a target" />
        )}
        <StatTile label="Best / Worst Case" value={`${best.toFixed(0)}% / ${worst.toFixed(0)}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-caption uppercase tracking-wide text-muted-foreground">Schedule</p>
            <ScheduleBlockForm courseId={course.id} />
          </div>
          {sortedBlocks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground/50">No class times added</p>
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
            <p className="text-caption uppercase tracking-wide text-muted-foreground">Materials</p>
            <div className="flex items-center gap-2">
              <MaterialQa courseId={course.id} hasMaterials={materials.length > 0} />
              <MaterialForm courseId={course.id} />
            </div>
          </div>
          {materials.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground/50">No materials uploaded</p>
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
          <p className="text-caption uppercase tracking-wide text-muted-foreground">Assessments</p>
          <AssessmentForm courseId={course.id} />
        </div>
        {assessments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            No assessments yet.
          </p>
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
