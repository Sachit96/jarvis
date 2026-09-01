/**
 * UniOS grade engine — pure functions, no LLM, no I/O. Everything else in
 * UniOS (the course dashboard, the risk chips on /uni, the daily-brief
 * academics section) depends on these being correct, so they're kept small,
 * self-contained, and documented with the exact math each one does.
 */

export type AssessmentStatus = "not_started" | "in_progress" | "submitted" | "graded";

export interface GradeAssessment {
  id: string;
  weight_pct: number;
  max_score: number;
  earned_score: number | null;
  /** Plain string, not the narrow AssessmentStatus union — DB rows come back with status typed as a generic check-constrained text column, and these functions only ever compare against the literal "graded"/"submitted", so a wider type here avoids forcing a cast at every call site. */
  status: string;
  due_at: string | null;
}

export interface GradeCourse {
  id: string;
  credit_weight: number;
  target_grade: number | null;
}

/**
 * Current running grade, as a percentage (0-100), based ONLY on graded
 * assessments — normalized by the weight of what's actually been graded,
 * not the course's full 100%. This is "what would my grade be if the
 * course ended today," the number a student actually expects to see.
 * Returns null when nothing is graded yet (there is no "current grade").
 */
export function courseGrade(assessments: GradeAssessment[]): number | null {
  const graded = assessments.filter((a) => a.status === "graded" && a.earned_score != null && a.max_score > 0);
  const totalWeightGraded = graded.reduce((sum, a) => sum + a.weight_pct, 0);
  if (totalWeightGraded <= 0) return null;
  const weightedSum = graded.reduce((sum, a) => sum + (a.earned_score! / a.max_score) * a.weight_pct, 0);
  return (weightedSum / totalWeightGraded) * 100;
}

/**
 * Credit-weighted average across courses that have a current grade
 * (courseGrade() !== null). Courses with nothing graded yet don't drag the
 * average toward 0 — they're excluded, not counted as failing.
 */
export function semesterAverage(courses: { credit_weight: number; grade: number | null }[]): number | null {
  const withGrades = courses.filter((c) => c.grade != null);
  const totalCredits = withGrades.reduce((sum, c) => sum + c.credit_weight, 0);
  if (totalCredits <= 0) return null;
  const weightedSum = withGrades.reduce((sum, c) => sum + c.grade! * c.credit_weight, 0);
  return weightedSum / totalCredits;
}

export interface NeededOnRemainingResult {
  /** Required average score, as a % of each remaining assessment's max_score, to hit the target. Can exceed 100 — see `possible`. */
  requiredAvgPct: number;
  /** False when requiredAvgPct > 100 — the target is no longer mathematically reachable. */
  possible: boolean;
  /** True when there's nothing left to grade — the final grade is already locked in. */
  locked: boolean;
}

/**
 * What average score is needed on the remaining (non-graded) assessments
 * to hit `targetGrade` as the FINAL course grade — unlike courseGrade(),
 * this projects against the course's full weight (assumed to sum to
 * ~100), not just the weight graded so far.
 */
export function neededOnRemaining(assessments: GradeAssessment[], targetGrade: number): NeededOnRemainingResult {
  const totalWeight = assessments.reduce((sum, a) => sum + a.weight_pct, 0);
  const graded = assessments.filter((a) => a.status === "graded" && a.earned_score != null && a.max_score > 0);
  const gradedWeight = graded.reduce((sum, a) => sum + a.weight_pct, 0);
  const remainingWeight = totalWeight - gradedWeight;
  const earnedPoints = graded.reduce((sum, a) => sum + (a.earned_score! / a.max_score) * a.weight_pct, 0);
  const neededPoints = (targetGrade / 100) * totalWeight - earnedPoints;

  if (remainingWeight <= 0) {
    // Nothing left to grade — the final grade is exactly earnedPoints (as
    // a % of totalWeight), already decided either way.
    const finalPct = totalWeight > 0 ? (earnedPoints / totalWeight) * 100 : 0;
    return { requiredAvgPct: 0, possible: finalPct >= targetGrade, locked: true };
  }

  const requiredAvgPct = (neededPoints / remainingWeight) * 100;
  return {
    requiredAvgPct: Math.max(0, requiredAvgPct),
    possible: requiredAvgPct <= 100,
    locked: false,
  };
}

/**
 * "What if I get X% on the midterm" — merges hypothetical percentage
 * scores (keyed by assessment id) into the real data as if they'd been
 * graded, then reuses courseGrade()'s exact running-average semantics.
 * hypotheticalPct values are percentages (0-100), not raw scores.
 */
export function simulate(assessments: GradeAssessment[], hypotheticalPct: Record<string, number>): number | null {
  const merged = assessments.map((a): GradeAssessment => {
    const pct = hypotheticalPct[a.id];
    if (pct == null) return a;
    return { ...a, status: "graded", earned_score: (pct / 100) * a.max_score };
  });
  return courseGrade(merged);
}

/** Projected FINAL grade assuming every remaining (non-graded) assessment scores `remainingPct`. Shared implementation for bestCase/worstCase. */
function projectFinal(assessments: GradeAssessment[], remainingPct: number): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const a of assessments) {
    totalWeight += a.weight_pct;
    if (a.status === "graded" && a.earned_score != null && a.max_score > 0) {
      weightedSum += (a.earned_score / a.max_score) * a.weight_pct;
    } else {
      weightedSum += (remainingPct / 100) * a.weight_pct;
    }
  }
  return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
}

/** Projected final grade assuming 100% on everything not yet graded. */
export function bestCase(assessments: GradeAssessment[]): number {
  return projectFinal(assessments, 100);
}

/** Projected final grade assuming 0% on everything not yet graded. */
export function worstCase(assessments: GradeAssessment[]): number {
  return projectFinal(assessments, 0);
}

/**
 * 0-100 risk score for a course, composited from four signals with fixed
 * point budgets (documented here since the weighting is a judgment call,
 * not a derived formula):
 *   - up to 40 pts: gap between current running grade and target (2 pts
 *     per percentage point behind, capped) — the dominant signal, since
 *     it's the actual outcome that matters
 *   - up to 20 pts: fraction of course weight still ungraded — more
 *     unresolved weight means more uncertainty, independent of how things
 *     currently look
 *   - up to 25 pts: overdue, unsubmitted assessments (12.5 pts each,
 *     capped at 2) — a concrete, already-happened problem, weighted
 *     heavily on purpose
 *   - up to 15 pts: proximity of the next deadline (15 pts if <=1 day,
 *     10 if <=3 days, 5 if <=7 days, 0 otherwise)
 * A course with nothing graded yet and a distant deadline scores low —
 * risk should reflect an actual problem, not just "the semester started."
 */
export function riskScore(course: { target_grade: number | null }, assessments: GradeAssessment[], now: Date = new Date()): number {
  let score = 0;

  const current = courseGrade(assessments);
  const target = course.target_grade ?? 80;
  if (current != null) {
    const gap = Math.max(0, target - current);
    score += Math.min(40, gap * 2);
  }

  const totalWeight = assessments.reduce((sum, a) => sum + a.weight_pct, 0);
  const gradedWeight = assessments.filter((a) => a.status === "graded").reduce((sum, a) => sum + a.weight_pct, 0);
  const remainingWeightFrac = totalWeight > 0 ? (totalWeight - gradedWeight) / totalWeight : 0;
  score += remainingWeightFrac * 20;

  const overdueCount = assessments.filter(
    (a) => a.due_at && new Date(a.due_at) < now && a.status !== "submitted" && a.status !== "graded",
  ).length;
  score += Math.min(25, overdueCount * 12.5);

  const upcoming = assessments
    .filter((a) => a.due_at && new Date(a.due_at) >= now && a.status !== "graded")
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
  if (upcoming.length > 0) {
    const daysToNext = (new Date(upcoming[0].due_at!).getTime() - now.getTime()) / 86_400_000;
    if (daysToNext <= 1) score += 15;
    else if (daysToNext <= 3) score += 10;
    else if (daysToNext <= 7) score += 5;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

/** Detects weeks with multiple high-weight (>=15%) assessments due within a 7-day window — used by the risk engine and the daily brief. */
export function findOverloadedWeeks(
  assessments: (GradeAssessment & { title: string; courseCode: string })[],
  now: Date = new Date(),
  weightThreshold = 15,
): { windowStart: string; items: { title: string; courseCode: string; due_at: string }[] }[] {
  const heavy = assessments
    .filter((a) => a.due_at && a.weight_pct >= weightThreshold && new Date(a.due_at) >= now && a.status !== "graded")
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());

  const windows: { windowStart: string; items: { title: string; courseCode: string; due_at: string }[] }[] = [];
  const used = new Set<string>();

  for (const anchor of heavy) {
    if (used.has(anchor.id)) continue;
    const anchorTime = new Date(anchor.due_at!).getTime();
    const windowItems = heavy.filter((a) => {
      const t = new Date(a.due_at!).getTime();
      return t >= anchorTime && t - anchorTime <= 7 * 86_400_000;
    });
    if (windowItems.length >= 2) {
      windowItems.forEach((i) => used.add(i.id));
      windows.push({
        windowStart: anchor.due_at!,
        items: windowItems.map((i) => ({ title: i.title, courseCode: i.courseCode, due_at: i.due_at! })),
      });
    }
  }

  return windows;
}
