/**
 * Grouping and totals for planned study sessions.
 *
 * Pure, and separate from the component, for the same reason the attendance
 * and timetable maths are: this is where the off-by-one-day mistakes live,
 * and a function is testable where a React tree is not.
 *
 * `planned_start` is a timestamp, so every comparison here goes through a
 * local calendar-date key. Slicing the ISO string would read it as UTC and
 * put a 7pm session on tomorrow's list west of UTC — the same trap already
 * documented in schedule-occurrences.ts and worked around in three other
 * files in this module.
 */

export interface StudySessionLike {
  id: string;
  course_id: string;
  assessment_id: string | null;
  planned_start: string;
  planned_minutes: number;
  actual_minutes: number | null;
  completed: boolean;
  notes: string | null;
}

export type SessionBucket = "overdue" | "today" | "upcoming" | "done";

export const BUCKET_LABEL: Record<SessionBucket, string> = {
  overdue: "Missed",
  today: "Tonight",
  upcoming: "Coming up",
  done: "Done",
};

/** Local calendar-date key for a timestamp. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Which list a session belongs on.
 *
 * A completed session is always "done" regardless of when it was planned —
 * finishing Tuesday's block on Wednesday is a success, not a miss.
 */
export function bucketFor(session: StudySessionLike, today: string): SessionBucket {
  if (session.completed) return "done";
  const key = dayKey(session.planned_start);
  if (key < today) return "overdue";
  if (key === today) return "today";
  return "upcoming";
}

export interface GroupedSessions {
  overdue: StudySessionLike[];
  today: StudySessionLike[];
  upcoming: StudySessionLike[];
  done: StudySessionLike[];
}

export function groupSessions<T extends StudySessionLike>(
  sessions: T[],
  today: string,
): { [K in SessionBucket]: T[] } {
  const out = { overdue: [] as T[], today: [] as T[], upcoming: [] as T[], done: [] as T[] };
  for (const s of sessions) out[bucketFor(s, today)].push(s);
  for (const key of Object.keys(out) as SessionBucket[]) {
    // Done reads newest-first (what did I just finish); everything else
    // reads soonest-first (what is next).
    out[key].sort((a, b) =>
      key === "done"
        ? b.planned_start.localeCompare(a.planned_start)
        : a.planned_start.localeCompare(b.planned_start),
    );
  }
  return out;
}

/**
 * The sessions today's progress counter measures.
 *
 * Selected by planned DATE, deliberately not by display bucket. Bucketing
 * moves a session to "done" the moment it is ticked, so a counter built from
 * overdue+today emptied itself as you worked: completing a block removed it
 * from the numerator and the denominator at once, and "done today" was
 * pinned at 0m no matter how much you got through. Caught by clicking the
 * checkbox in a real browser, not by reading the component.
 */
export function todaysPlan<T extends StudySessionLike>(sessions: T[], today: string): T[] {
  return sessions.filter((s) => dayKey(s.planned_start) === today);
}

export interface SessionTotals {
  plannedMinutes: number;
  completedMinutes: number;
  completedCount: number;
  totalCount: number;
}

/**
 * Totals for one day's plan.
 *
 * `actual_minutes` is what was really spent and is preferred when present;
 * a session ticked off without a figure falls back to what was planned,
 * which is the honest reading of "I did the block I planned".
 */
export function totalsFor(sessions: StudySessionLike[]): SessionTotals {
  let plannedMinutes = 0;
  let completedMinutes = 0;
  let completedCount = 0;
  for (const s of sessions) {
    plannedMinutes += s.planned_minutes;
    if (s.completed) {
      completedCount += 1;
      completedMinutes += s.actual_minutes ?? s.planned_minutes;
    }
  }
  return { plannedMinutes, completedMinutes, completedCount, totalCount: sessions.length };
}

/** "1h 30m", "45m", "2h" — never "0h 45m" or a bare minute count over an hour. */
export function formatMinutes(total: number): string {
  if (total <= 0) return "0m";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
