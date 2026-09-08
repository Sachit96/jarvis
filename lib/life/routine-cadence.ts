/**
 * When a routine is due.
 *
 * Habits were implicitly daily: one habit_logs row per habit per day, with
 * nothing recording how often the habit was *meant* to happen. That made a
 * weekly routine ("Sunday planning") inexpressible — it would show as
 * missed six days out of seven and wreck the streak. Migration 0036 adds
 * the smallest thing that fixes it: a cadence and, for weekly, which days.
 *
 * Deliberately NOT a general recurrence rule (RRULE, intervals, "every
 * third Tuesday"). Nothing in JARVIS needs that, and an unused general
 * mechanism is harder to reason about than the specific one that is used.
 *
 * Pure and clock-free: the caller passes the date, so this is testable and
 * cannot disagree between the routine page, the Home card and the tools.
 */

export type RoutineCadence = "daily" | "weekly";

export interface CadenceLike {
  cadence?: string | null;
  /** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
  days_of_week?: number[] | null;
}

/**
 * `date` is `yyyy-mm-dd`.
 *
 * Parsed with an explicit local-midnight suffix rather than `new Date(date)`,
 * which JavaScript reads as UTC for a bare date string — that is a whole
 * day's shift for anyone west of UTC, and would report the wrong weekday.
 */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00`).getDay();
}

export function isDueOn(habit: CadenceLike, date: string): boolean {
  const cadence = habit.cadence ?? "daily";
  if (cadence !== "weekly") return true;

  const days = habit.days_of_week ?? [];
  // A weekly routine with no days chosen is not yet configured. Showing it
  // every day would be indistinguishable from daily and would silently
  // undo the user's choice of "weekly"; hiding it makes the unfinished
  // setup visible on the routine page instead.
  if (days.length === 0) return false;
  return days.includes(weekdayOf(date));
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Human-readable cadence, for the routine list and for tool results. */
export function describeCadence(habit: CadenceLike): string {
  const cadence = habit.cadence ?? "daily";
  if (cadence !== "weekly") return "Daily";
  const days = habit.days_of_week ?? [];
  if (days.length === 0) return "Weekly — no days set";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d] ?? "?")
    .join(", ");
}

/**
 * Dates in a window on which a routine was actually expected.
 *
 * Streaks and "missed" counts have to be computed against the days a
 * routine was DUE, not every calendar day — otherwise a weekly routine
 * looks perpetually broken. Returns oldest first.
 */
export function dueDatesInRange(habit: CadenceLike, from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  // Bounded so a reversed range or a bad date cannot spin forever; two
  // years is far more than any view here asks for.
  for (let guard = 0; guard < 750 && cursor <= end; guard++) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (isDueOn(habit, iso)) out.push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * Consecutive due-days completed, counting back from `today`.
 *
 * Differs from computeStreak in lib/db/queries/life.ts, which walks
 * calendar days and is correct for daily habits only. Today not yet being
 * done does not break the streak — the day is not over — so the count
 * starts from the most recent due day that has passed.
 */
export function cadenceStreak(
  habit: CadenceLike,
  completedDates: Set<string>,
  today: string,
): number {
  // 400 days back covers a year of weekly routines with room to spare.
  const start = new Date(`${today}T00:00:00`);
  start.setDate(start.getDate() - 400);
  const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

  const dueDays = dueDatesInRange(habit, startIso, today);
  let streak = 0;
  for (let i = dueDays.length - 1; i >= 0; i--) {
    const day = dueDays[i];
    if (completedDates.has(day)) {
      streak++;
      continue;
    }
    // Today is allowed to be incomplete without breaking the run; any
    // earlier due day that was missed ends it.
    if (day === today) continue;
    break;
  }
  return streak;
}
