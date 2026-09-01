import Link from "next/link";
import { Card } from "@/components/ui/card";
import { RiskChip } from "@/components/uni/risk-chip";
import { courseGrade, riskScore, type GradeAssessment } from "@/lib/uni/grades";
import type { Database } from "@/lib/supabase/database.types";

type Course = Database["public"]["Tables"]["uni_courses"]["Row"];

export function CourseCard({ course, assessments }: { course: Course; assessments: GradeAssessment[] }) {
  const grade = courseGrade(assessments);
  const risk = riskScore(course, assessments);

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
            <p className="text-caption uppercase tracking-wide text-muted-foreground">Current grade</p>
            <p className="mt-1 font-mono text-title tabular-nums text-foreground">{grade != null ? `${grade.toFixed(1)}%` : "—"}</p>
          </div>
          {course.target_grade != null ? (
            <div className="text-right">
              <p className="text-caption uppercase tracking-wide text-muted-foreground">Target</p>
              <p className="mt-1 font-mono text-body tabular-nums text-muted-foreground">{course.target_grade}%</p>
            </div>
          ) : null}
        </div>
        {course.professor ? <p className="mt-3 text-caption text-muted-foreground">{course.professor}{course.room ? ` · ${course.room}` : ""}</p> : null}
      </Card>
    </Link>
  );
}
