import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  courseGrade,
  semesterAverage,
  neededOnRemaining,
  simulate,
  bestCase,
  worstCase,
  riskScore,
  findOverloadedWeeks,
  type GradeAssessment,
} from "../lib/uni/grades.ts";

// Codifies the cases hand-verified against the real /uni UI earlier this
// project (real seeded course data, checked against what actually rendered
// on screen — not just that the pure functions returned *a* number). The
// exact original scenarios weren't preserved anywhere retrievable, so this
// rebuilds equivalent coverage of the same ground: a mid-semester course
// with some graded/some pending work, an all-graded (locked) course, an
// empty course, and the edge cases each function's own doc comment calls
// out (unreachable target, zero remaining weight, no target set).

function assessment(overrides: Partial<GradeAssessment> & Pick<GradeAssessment, "id">): GradeAssessment {
  return {
    weight_pct: 0,
    max_score: 100,
    earned_score: null,
    status: "not_started",
    due_at: null,
    ...overrides,
  };
}

describe("courseGrade", () => {
  test("null when nothing is graded yet", () => {
    const assessments = [assessment({ id: "a1", weight_pct: 30, status: "not_started" })];
    assert.equal(courseGrade(assessments), null);
  });

  test("normalizes by graded weight, not total course weight", () => {
    // 2 of 3 assessments graded (30% + 20% = 50% of the course), scored
    // 80% and 90% respectively — running grade is the weighted average of
    // just those two, not diluted by the ungraded 50%.
    const assessments: GradeAssessment[] = [
      assessment({ id: "a1", weight_pct: 30, max_score: 100, earned_score: 80, status: "graded" }),
      assessment({ id: "a2", weight_pct: 20, max_score: 50, earned_score: 45, status: "graded" }), // 90%
      assessment({ id: "a3", weight_pct: 50, status: "not_started" }),
    ];
    const grade = courseGrade(assessments);
    assert.ok(grade !== null);
    // (0.8*30 + 0.9*20) / 50 * 100 = 84
    assert.equal(Math.round(grade! * 100) / 100, 84);
  });

  test("ignores a zero-max_score row rather than dividing by zero", () => {
    const assessments: GradeAssessment[] = [
      assessment({ id: "a1", weight_pct: 30, max_score: 0, earned_score: 0, status: "graded" }),
      assessment({ id: "a2", weight_pct: 20, max_score: 100, earned_score: 100, status: "graded" }),
    ];
    assert.equal(courseGrade(assessments), 100);
  });
});

describe("semesterAverage", () => {
  test("credit-weighted, excludes courses with no grade yet (not counted as 0)", () => {
    const courses = [
      { credit_weight: 3, grade: 90 },
      { credit_weight: 3, grade: 70 },
      { credit_weight: 3, grade: null }, // a brand-new course with nothing graded — must not drag the average down
    ];
    assert.equal(semesterAverage(courses), 80); // (90*3 + 70*3) / 6
  });

  test("null when no course has a grade yet", () => {
    assert.equal(semesterAverage([{ credit_weight: 3, grade: null }]), null);
  });
});

describe("neededOnRemaining", () => {
  test("reachable target: computes the required average on what's left", () => {
    // 50% graded at 84% running; need 90% final. Remaining 50% must average
    // enough to pull the total up.
    const assessments: GradeAssessment[] = [
      assessment({ id: "a1", weight_pct: 50, max_score: 100, earned_score: 84, status: "graded" }),
      assessment({ id: "a2", weight_pct: 50, status: "not_started" }),
    ];
    const result = neededOnRemaining(assessments, 90);
    // earnedPoints = 0.84*50 = 42; neededPoints = 0.9*100 - 42 = 48; remainingWeight = 50
    // requiredAvgPct = 48/50*100 = 96
    assert.equal(Math.round(result.requiredAvgPct), 96);
    assert.equal(result.possible, true);
    assert.equal(result.locked, false);
  });

  test("unreachable target: possible is false when required average exceeds 100", () => {
    const assessments: GradeAssessment[] = [
      assessment({ id: "a1", weight_pct: 80, max_score: 100, earned_score: 40, status: "graded" }),
      assessment({ id: "a2", weight_pct: 20, status: "not_started" }),
    ];
    const result = neededOnRemaining(assessments, 90);
    assert.equal(result.possible, false);
    assert.ok(result.requiredAvgPct > 100);
  });

  test("locked: nothing left to grade — final grade is already decided", () => {
    const assessments: GradeAssessment[] = [
      assessment({ id: "a1", weight_pct: 100, max_score: 100, earned_score: 88, status: "graded" }),
    ];
    const result = neededOnRemaining(assessments, 90);
    assert.equal(result.locked, true);
    assert.equal(result.possible, false); // 88 < 90, target was missed
    assert.equal(result.requiredAvgPct, 0);
  });
});

describe("simulate", () => {
  test("merges a hypothetical percentage as if graded, without mutating input", () => {
    const assessments: GradeAssessment[] = [
      assessment({ id: "a1", weight_pct: 50, max_score: 100, earned_score: 80, status: "graded" }),
      assessment({ id: "a2", weight_pct: 50, max_score: 100, status: "not_started" }),
    ];
    const result = simulate(assessments, { a2: 100 });
    assert.equal(result, 90); // (0.8*50 + 1.0*50) / 100 * 100
    assert.equal(assessments[1].status, "not_started"); // original untouched
  });
});

describe("bestCase / worstCase", () => {
  const assessments: GradeAssessment[] = [
    assessment({ id: "a1", weight_pct: 50, max_score: 100, earned_score: 80, status: "graded" }),
    assessment({ id: "a2", weight_pct: 50, status: "not_started" }),
  ];

  test("bestCase assumes 100% on everything ungraded", () => {
    assert.equal(bestCase(assessments), 90); // (0.8*50 + 1.0*50)
  });

  test("worstCase assumes 0% on everything ungraded", () => {
    assert.equal(worstCase(assessments), 40); // (0.8*50 + 0*50)
  });
});

describe("riskScore", () => {
  test("a course with nothing graded and a distant deadline scores low", () => {
    const now = new Date("2026-01-01");
    const assessments: GradeAssessment[] = [
      assessment({ id: "a1", weight_pct: 100, due_at: "2026-06-01", status: "not_started" }),
    ];
    const score = riskScore({ target_grade: 80 }, assessments, now);
    assert.ok(score <= 20, `expected a low score for a distant, ungraded course, got ${score}`);
  });

  test("an overdue, unsubmitted assessment pushes risk up meaningfully", () => {
    const now = new Date("2026-06-01");
    const assessments: GradeAssessment[] = [
      assessment({ id: "a1", weight_pct: 50, due_at: "2026-05-01", status: "not_started" }), // overdue
    ];
    const score = riskScore({ target_grade: 80 }, assessments, now);
    assert.ok(score >= 25, `expected overdue work to contribute at least its 25pt cap, got ${score}`);
  });

  test("clamped to [0, 100]", () => {
    const now = new Date("2026-06-01");
    const assessments: GradeAssessment[] = [
      assessment({ id: "a1", weight_pct: 40, max_score: 100, earned_score: 10, status: "graded" }),
      assessment({ id: "a2", weight_pct: 30, due_at: "2026-05-01", status: "not_started" }),
      assessment({ id: "a3", weight_pct: 30, due_at: "2026-05-15", status: "not_started" }),
    ];
    const score = riskScore({ target_grade: 95 }, assessments, now);
    assert.ok(score >= 0 && score <= 100);
  });
});

describe("findOverloadedWeeks", () => {
  test("groups >=2 heavy assessments due within 7 days into one window", () => {
    const now = new Date("2026-01-01");
    const items = [
      { id: "a1", title: "Midterm", courseCode: "CS101", weight_pct: 20, max_score: 100, earned_score: null, status: "not_started", due_at: "2026-01-10" },
      { id: "a2", title: "Essay", courseCode: "ENG201", weight_pct: 15, max_score: 100, earned_score: null, status: "not_started", due_at: "2026-01-14" },
      { id: "a3", title: "Quiz", courseCode: "CS101", weight_pct: 5, max_score: 100, earned_score: null, status: "not_started", due_at: "2026-02-01" }, // below threshold, excluded
    ];
    const windows = findOverloadedWeeks(items, now);
    assert.equal(windows.length, 1);
    assert.equal(windows[0].items.length, 2);
    assert.deepEqual(
      windows[0].items.map((i) => i.title).sort(),
      ["Essay", "Midterm"],
    );
  });

  test("no window when heavy assessments are more than 7 days apart", () => {
    const now = new Date("2026-01-01");
    const items = [
      { id: "a1", title: "Midterm", courseCode: "CS101", weight_pct: 20, max_score: 100, earned_score: null, status: "not_started", due_at: "2026-01-10" },
      { id: "a2", title: "Final", courseCode: "CS101", weight_pct: 30, max_score: 100, earned_score: null, status: "not_started", due_at: "2026-02-10" },
    ];
    assert.equal(findOverloadedWeeks(items, now).length, 0);
  });
});
