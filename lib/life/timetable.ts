/**
 * Weekly life-schedule arithmetic — the personal-routine counterpart to
 * lib/uni/timetable.ts.
 *
 * Deliberately a separate, smaller module rather than generalizing the uni
 * one: uni's occursOn/term-clamping machinery answers "does this class
 * actually run today" (reading week, term boundaries), and
 * life_schedule_blocks has no such concept — every block runs every week,
 * always, with no term to fall outside of. Threading unused term params
 * through a shared type just to satisfy TypeScript would cost more than
 * this small a duplication does.
 *
 * Same pure-function shape as the uni module, for the same reason: "now" is
 * passed in, never read from the clock, so "is this the current block" is
 * testable regardless of when the test runs.
 */

export interface WeekBlockLike {
  id: string;
  /** 0 = Sunday .. 6 = Saturday, matching Date#getDay(). */
  day_of_week: number;
  /** "HH:MM" or "HH:MM:SS". */
  start_time: string;
  end_time: string;
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Minutes since midnight, or null when the value is not a time. */
export function toMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatTime(time: string): string {
  const minutes = toMinutes(time);
  if (minutes === null) return time;
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

export interface DayColumn<T> {
  dayOfWeek: number;
  label: string;
  blocks: T[];
}

/** One column per weekday, each sorted by start time. Empty days are kept. */
export function byDay<T extends WeekBlockLike>(blocks: T[]): DayColumn<T>[] {
  return DAY_LABELS.map((label, dayOfWeek) => ({
    dayOfWeek,
    label,
    blocks: blocks
      .filter((b) => b.day_of_week === dayOfWeek)
      .sort((a, b) => (toMinutes(a.start_time) ?? 0) - (toMinutes(b.start_time) ?? 0)),
  }));
}

/**
 * The earliest start and latest end across the week, so the grid spans only
 * the hours that actually have blocks. Falls back to a plausible waking day
 * (6am-11pm) when there are no blocks at all, matching this routine's own
 * earliest wake time rather than the uni module's teaching-day default.
 */
export function gridRange(blocks: WeekBlockLike[]): { startHour: number; endHour: number } {
  const starts = blocks.map((b) => toMinutes(b.start_time)).filter((m): m is number => m !== null);
  const ends = blocks.map((b) => toMinutes(b.end_time)).filter((m): m is number => m !== null);
  if (starts.length === 0 || ends.length === 0) return { startHour: 6, endHour: 23 };
  return {
    startHour: Math.floor(Math.min(...starts) / 60),
    endHour: Math.min(24, Math.ceil(Math.max(...ends) / 60)),
  };
}

export interface NowContext {
  dayOfWeek: number;
  minutes: number;
}

/** Reads the clock once, at the edge, so everything below stays pure. */
export function nowContext(date: Date): NowContext {
  return { dayOfWeek: date.getDay(), minutes: date.getHours() * 60 + date.getMinutes() };
}

/** The block happening right now, or null. Inclusive of start, exclusive of end. */
export function currentBlock<T extends WeekBlockLike>(blocks: T[], now: NowContext): T | null {
  return (
    blocks.find((b) => {
      if (b.day_of_week !== now.dayOfWeek) return false;
      const start = toMinutes(b.start_time);
      const end = toMinutes(b.end_time);
      if (start === null || end === null) return false;
      return now.minutes >= start && now.minutes < end;
    }) ?? null
  );
}

export interface NextBlockResult<T> {
  block: T;
  /** Whole days ahead: 0 = later today, 1 = tomorrow. */
  daysAhead: number;
  minutesUntil: number;
}

/**
 * The next block that starts after now, searching forward through the week
 * and wrapping around. Unlike lib/uni/timetable.ts's nextClass, this never
 * returns null once there is at least one timed block — every block here
 * recurs every week with nothing to suspend it.
 */
export function nextBlock<T extends WeekBlockLike>(blocks: T[], now: NowContext): NextBlockResult<T> | null {
  let best: NextBlockResult<T> | null = null;

  for (const block of blocks) {
    const start = toMinutes(block.start_time);
    if (start === null) continue;

    let daysAhead = (block.day_of_week - now.dayOfWeek + 7) % 7;
    // Same weekday but already started → it is next week's occurrence.
    if (daysAhead === 0 && start <= now.minutes) daysAhead = 7;

    const minutesUntil = daysAhead * 24 * 60 + start - now.minutes;
    if (!best || minutesUntil < best.minutesUntil) best = { block, daysAhead, minutesUntil };
  }

  return best;
}

/** "in 25 min", "in 3h 10m", "tomorrow", "in 4 days". */
export function describeUntil(minutesUntil: number): string {
  if (minutesUntil < 60) return `in ${minutesUntil} min`;
  if (minutesUntil < 24 * 60) {
    const h = Math.floor(minutesUntil / 60);
    const m = minutesUntil % 60;
    return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
  }
  const days = Math.round(minutesUntil / (24 * 60));
  return days === 1 ? "tomorrow" : `in ${days} days`;
}
