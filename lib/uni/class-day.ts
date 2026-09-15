/**
 * Which classes actually happen on one calendar date.
 *
 * The calendar already got this right — it clamps recurring occurrences to
 * each course's term dates and drops the ones inside a no-class period.
 * /uni/attendance did not: it matched schedule blocks on weekday alone, so
 * on Thanksgiving Monday, during reading week, or three weeks after the
 * term ended it still listed classes and invited you to mark yourself
 * present at them. Recording attendance at a class that did not happen is
 * worse than recording nothing — the percentage it feeds is the number a
 * student uses to decide whether they can miss Friday.
 *
 * Pure, and takes its date as an argument rather than reading the clock, so
 * the term-boundary and holiday cases are testable directly.
 */

export interface ClassDayBlock {
  course_id: string;
  day_of_week: number;
}

export interface ClassDayCourse {
  id: string;
  term_start?: string | null;
  term_end?: string | null;
}

export interface NoClassPeriod {
  /** Null means university-wide — a statutory holiday, not one course's break. */
  course_id: string | null;
  start_date: string;
  end_date: string;
  /** "Reading week", "Thanksgiving" — shown in the empty state. */
  label?: string | null;
}

/** Why nothing is scheduled, when a weekday that normally has classes has none. */
export type NoClassReason = { kind: "break"; label: string } | { kind: "outside_term" } | null;

/** Inclusive on both ends. Plain string comparison is correct — "YYYY-MM-DD" sorts chronologically. */
function within(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

/**
 * Filters weekly schedule blocks down to the ones that genuinely occur on
 * `date`. A course whose term_start/term_end are unset is not clamped —
 * those columns are nullable and empty until someone fills them in, and
 * treating "unknown" as "outside the term" would hide every class.
 */
export function classesOnDate<T extends ClassDayBlock>(
  blocks: T[],
  date: string,
  {
    courses = [],
    noClassPeriods = [],
  }: { courses?: ClassDayCourse[]; noClassPeriods?: NoClassPeriod[] } = {},
): T[] {
  // Parsing a bare YYYY-MM-DD reads it as UTC midnight, which lands on the
  // previous weekday anywhere west of UTC. The explicit time forces local.
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const courseById = new Map(courses.map((c) => [c.id, c]));

  return blocks.filter((block) => {
    if (block.day_of_week !== weekday) return false;

    const course = courseById.get(block.course_id);
    if (course?.term_start && course?.term_end && !within(date, course.term_start, course.term_end)) {
      return false;
    }

    return !noClassPeriods.some(
      (p) =>
        (p.course_id === null || p.course_id === block.course_id) &&
        within(date, p.start_date, p.end_date),
    );
  });
}

/**
 * Why `date` has no classes, for the empty state. Distinguishes "reading
 * week" from "the term is over" from "it's Saturday", because "No classes
 * today" alone reads as a data problem when it is really a holiday.
 *
 * Returns null when the day simply has nothing timetabled on it.
 */
export function noClassReason(
  date: string,
  {
    courses = [],
    noClassPeriods = [],
  }: { courses?: ClassDayCourse[]; noClassPeriods?: NoClassPeriod[] } = {},
): NoClassReason {
  const period = noClassPeriods.find((p) => within(date, p.start_date, p.end_date));
  if (period) {
    return { kind: "break", label: period.label || "Scheduled break" };
  }

  // Only claim "outside term" when every course with known dates agrees.
  // With no dated courses at all there is nothing to conclude.
  const dated = courses.filter((c) => c.term_start && c.term_end);
  if (dated.length > 0 && dated.every((c) => !within(date, c.term_start!, c.term_end!))) {
    return { kind: "outside_term" };
  }

  return null;
}
