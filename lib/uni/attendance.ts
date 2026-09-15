/**
 * Attendance arithmetic, as pure functions over records.
 *
 * No React, no database, no dates read from the clock — every function takes
 * what it needs. That is what lets the risk thresholds be tested directly
 * instead of by rendering a page, and it is the same split the rest of
 * lib/uni already uses (grades.ts computes, the page renders).
 */

export type AttendanceStatus = "present" | "absent" | "late" | "excused" | "cancelled";

export interface AttendanceRecord {
  course_id: string;
  class_date: string;
  status: AttendanceStatus;
}

/**
 * How each status counts.
 *
 * The two that are easy to get wrong, and matter most to a student:
 *
 * - `cancelled` is not a class. It leaves the denominator entirely — counting
 *   a cancelled lecture as a miss would punish the student for the
 *   university's decision.
 * - `excused` also leaves the denominator. An excused absence is one the
 *   institution has already accepted; folding it into the percentage would
 *   make the number disagree with the one the registrar would compute.
 *
 * `late` counts as attended: you were there. It is tracked separately so a
 * pattern of lateness is still visible.
 */
const COUNTS_AS_ATTENDED: Record<AttendanceStatus, boolean> = {
  present: true,
  late: true,
  absent: false,
  excused: false,
  cancelled: false,
};

const IN_DENOMINATOR: Record<AttendanceStatus, boolean> = {
  present: true,
  late: true,
  absent: true,
  excused: false,
  cancelled: false,
};

/** Most institutions treat 75% as the line; below it is a real problem. */
export const ATTENDANCE_THRESHOLD = 75;
/** Close enough to the line that one more miss could cross it. */
export const ATTENDANCE_WARNING = 80;

export type AttendanceRisk = "good" | "warning" | "at_risk" | "no_data";

export interface AttendanceSummary {
  attended: number;
  missed: number;
  late: number;
  excused: number;
  cancelled: number;
  /** Classes that actually count toward the percentage. */
  counted: number;
  /** Null rather than 0 when nothing counts yet — 0% and "no classes" are different facts. */
  percent: number | null;
  risk: AttendanceRisk;
  /**
   * How many consecutive classes could be missed before dropping below the
   * threshold. Null when there is no data. This is the number a student
   * actually wants: "can I skip Friday?"
   */
  canMiss: number;
}

export function summarise(records: AttendanceRecord[]): AttendanceSummary {
  let attended = 0, missed = 0, late = 0, excused = 0, cancelled = 0, counted = 0;

  for (const record of records) {
    if (record.status === "late") late++;
    if (record.status === "excused") excused++;
    if (record.status === "cancelled") cancelled++;
    if (IN_DENOMINATOR[record.status]) {
      counted++;
      if (COUNTS_AS_ATTENDED[record.status]) attended++;
      else missed++;
    }
  }

  const percent = counted === 0 ? null : Math.round((attended / counted) * 1000) / 10;

  return {
    attended, missed, late, excused, cancelled, counted, percent,
    risk: riskOf(percent),
    canMiss: percent === null ? 0 : classesCanMiss(attended, counted),
  };
}

export function riskOf(percent: number | null): AttendanceRisk {
  if (percent === null) return "no_data";
  if (percent < ATTENDANCE_THRESHOLD) return "at_risk";
  if (percent < ATTENDANCE_WARNING) return "warning";
  return "good";
}

/**
 * Consecutive future classes that can be missed while staying at or above the
 * threshold. Already below it → 0, since another miss cannot help.
 */
function classesCanMiss(attended: number, counted: number): number {
  if (counted === 0) return 0;
  let extra = 0;
  // Bounded: each iteration lowers the percentage, so this terminates well
  // before the cap on any real timetable.
  while (extra < 200) {
    const next = (attended / (counted + extra + 1)) * 100;
    if (next < ATTENDANCE_THRESHOLD) return extra;
    extra++;
  }
  return extra;
}

export interface CourseAttendance extends AttendanceSummary {
  courseId: string;
}

/** Per-course summaries, for the ring-per-course layout. */
export function summariseByCourse(records: AttendanceRecord[]): CourseAttendance[] {
  const byCourse = new Map<string, AttendanceRecord[]>();
  for (const record of records) {
    const list = byCourse.get(record.course_id) ?? [];
    list.push(record);
    byCourse.set(record.course_id, list);
  }
  return [...byCourse.entries()]
    .map(([courseId, list]) => ({ courseId, ...summarise(list) }))
    // Worst first: the number a student needs to see is the one in trouble.
    .sort((a, b) => (a.percent ?? 101) - (b.percent ?? 101));
}

/**
 * Attendance percentage after each class, oldest first — the trend line.
 * Only counted classes move it, so a cancelled class does not flatten it.
 */
export function trend(records: AttendanceRecord[]): { date: string; percent: number }[] {
  const chronological = [...records].sort((a, b) => a.class_date.localeCompare(b.class_date));
  const points: { date: string; percent: number }[] = [];
  let attended = 0, counted = 0;
  for (const record of chronological) {
    if (!IN_DENOMINATOR[record.status]) continue;
    counted++;
    if (COUNTS_AS_ATTENDED[record.status]) attended++;
    points.push({ date: record.class_date, percent: Math.round((attended / counted) * 1000) / 10 });
  }
  return points;
}
