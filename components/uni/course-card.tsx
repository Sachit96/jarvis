import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RiskChip } from "@/components/uni/risk-chip";
import { cn } from "@/lib/utils";
import { courseGrade, riskScore, type GradeAssessment, type GradeAssessmentGroup } from "@/lib/uni/grades";
import type { Database } from "@/lib/supabase/database.types";

type Course = Database["public"]["Tables"]["uni_courses"]["Row"];

export function CourseCard({
  course,
  assessments,
  groups = [],
}: {
  course: Course;
  assessments: (GradeAssessment & { needs_verification: boolean })[];
  groups?: GradeAssessmentGroup[];
}) {
  const grade = courseGrade(assessments, groups);
  const risk = riskScore(course, assessments, new Date(), groups);
  const needsVerificationCount = assessments.filter((a) => a.needs_verification).length;

  return (
    <Link href={`/uni/courses/${course.id}`} className="block outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-2xl">
      <Card interactive className="h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: course.color ?? "#8b5cf6" }} />
              <p className="truncate text-heading font-semibold text-foreground">{course.code}</p>
            </div>
            <p className="mt-0.5 truncate text-body text-muted-foreground">{course.name}</p>
          </div>
          <RiskChip score={risk} />
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <p className="eyebrow">Current grade</p>
            <p className={cn("mt-1 tabular text-title tabular-nums", assessments.length === 0 ? "text-muted-foreground/50" : "text-foreground")}>
              {assessments.length === 0 ? "No assessments" : grade != null ? `${grade.toFixed(1)}%` : "—"}
            </p>
          </div>
          {course.target_grade != null ? (
            <div className="text-right">
              <p className="eyebrow">Target</p>
              <p className="mt-1 tabular text-body tabular-nums text-muted-foreground">{course.target_grade}%</p>
            </div>
          ) : null}
        </div>
        {needsVerificationCount > 0 ? (
          <p className="mt-2 flex items-center gap-1 text-caption text-warn">
            <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />
            {needsVerificationCount} need{needsVerificationCount === 1 ? "s" : ""} verification
          </p>
        ) : null}
        {course.professor ? <p className="mt-3 text-caption text-muted-foreground">{course.professor}{course.room ? ` · ${course.room}` : ""}</p> : null}
      </Card>
    </Link>
  );
}
