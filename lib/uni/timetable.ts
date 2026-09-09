/**
 * Weekly timetable arithmetic.
 *
 * Pure: every function takes "now" rather than reading the clock, which is
 * what makes "is this the current class" testable at all — otherwise the
 * assertion depends on when the suite runs.
 *
 * Times are the "HH:MM" strings uni_schedule_blocks stores, compared as
 * minutes-since-midnight. Deliberately NOT parsed into Date objects: a
 * recurring block has no calendar date, so constructing one only invites the
 * timezone bug that lib/uni/schedule-occurrences.ts already documents.
 */

export interface TimetableBlock {
  id: string;
  course_id: string;
  /** 0 = Sunday .. 6 = Saturday, matching Date#getDay(). */
  day_of_week: number;
  /** "HH:MM" or "HH:MM:SS". */
  start_time: string;
  end_time: string;
  room: string | null;
  type: string;
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

export interface DayColumn {
  dayOfWeek: number;
  label: string;
  blocks: TimetableBlock[];
}

/** One column per weekday, each sorted by start time. Empty days are kept. */
export function byDay(blocks: TimetableBlock[]): DayColumn[] {
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
 * the hours that actually have classes. A fixed 00:00–23:00 grid would be
 * mostly empty space on any real timetable.
 *
 * Falls back to a plausible teaching day when there are no blocks at all,
 * so the empty grid still looks like a timetable rather than collapsing.
 */
export function gridRange(blocks: TimetableBlock[]): { startHour: number; endHour: number } {
  const starts = blocks.map((b) => toMinutes(b.start_time)).filter((m): m is number => m !== null);
  const ends = blocks.map((b) => toMinutes(b.end_time)).filter((m): m is number => m !== null);
  if (starts.length === 0 || ends.length === 0) return { startHour: 8, endHour: 18 };
  return {
    startHour: Math.floor(Math.min(...starts) / 60),
    // Round the end UP so a class finishing at 17:30 is not clipped.
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
export function currentBlock(blocks: TimetableBlock[], now: NowContext): TimetableBlock | null {
  return (
    blocks.find((b) => {
      if (b.day_of_week !== now.dayOfWeek) return false;
      const start = toMinutes(b.start_time);
      const end = toMinutes(b.end_time);
      if (start === null || end === null) return false;
      // A class that has just ended is not the current class.
      return now.minutes >= start && now.minutes < end;
    }) ?? null
  );
}

export interface NextClass {
  block: TimetableBlock;
  /** Whole days ahead: 0 = later today, 1 = tomorrow. */
  daysAhead: number;
  minutesUntil: number;
}

/**
 * The next class that starts after now, searching forward through the week
 * and wrapping around. Returns null only when there are no timed blocks at
 * all — with any timetable there is always a next class, even if it is next
 * Monday.
 */
export function nextClass(blocks: TimetableBlock[], now: NowContext): NextClass | null {
  let best: NextClass | null = null;

  for (const block of blocks) {
    const start = toMinutes(block.start_time);
    if (start === null) continue;

    // Days until this block's weekday comes round again.
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
