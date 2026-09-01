import { riskScore, type GradeAssessment, type GradeCourse } from "@/lib/uni/grades";

export interface PlannableAssessment extends GradeAssessment {
  title: string;
  course_id: string;
  estimated_hours: number | null;
}

export interface RankedItem {
  assessmentId: string;
  title: string;
  courseCode: string;
  minutes: number;
  priorityScore: number;
}

/**
 * Study planning (Work Order 3) — pure arithmetic, no LLM. Ranks
 * not-yet-graded assessments by a priority score (higher = do this first):
 * urgency (days to deadline, inverse and capped so a same-day item doesn't
 * dwarf everything), grade weight (bigger assessments matter more), and
 * the course's own risk score (a struggling course's work outranks an
 * equal-urgency item in a course that's already on track). Then greedily
 * allocates the given total minutes across the ranked list, giving each
 * item up to its estimated_hours (defaulting to 1.5h when unset) before
 * moving to the next, so time isn't spread thin across everything at once.
 */
export function planStudySessions(
  assessments: PlannableAssessment[],
  courses: (GradeCourse & { code: string })[],
  totalMinutes: number,
  now: Date = new Date(),
): RankedItem[] {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const assessmentsByCourse = new Map<string, PlannableAssessment[]>();
  for (const a of assessments) {
    if (!assessmentsByCourse.has(a.course_id)) assessmentsByCourse.set(a.course_id, []);
    assessmentsByCourse.get(a.course_id)!.push(a);
  }

  const pending = assessments.filter((a) => a.status !== "graded" && a.status !== "submitted");

  const scored = pending.map((a) => {
    const course = courseById.get(a.course_id);
    const courseAssessments = assessmentsByCourse.get(a.course_id) ?? [];
    const risk = course ? riskScore(course, courseAssessments, now) : 0;

    let urgencyScore = 10; // no due date — mild default urgency
    if (a.due_at) {
      const daysAway = (new Date(a.due_at).getTime() - now.getTime()) / 86_400_000;
      urgencyScore = daysAway <= 0 ? 40 : daysAway <= 1 ? 35 : daysAway <= 3 ? 25 : daysAway <= 7 ? 15 : 5;
    }
    const weightScore = Math.min(30, a.weight_pct);
    const riskContribution = risk * 0.3;

    return { assessment: a, course, priorityScore: urgencyScore + weightScore + riskContribution };
  });

  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  const result: RankedItem[] = [];
  let remaining = totalMinutes;
  for (const { assessment, course, priorityScore } of scored) {
    if (remaining <= 0) break;
    const wantMinutes = Math.round((assessment.estimated_hours ?? 1.5) * 60);
    const minutes = Math.min(wantMinutes, remaining, 180); // cap a single session at 3h regardless of estimate
    if (minutes < 15) continue; // not worth a session
    result.push({ assessmentId: assessment.id, title: assessment.title, courseCode: course?.code ?? "?", minutes, priorityScore: Math.round(priorityScore) });
    remaining -= minutes;
  }

  return result;
}
