/**
 * Projects recurring weekly schedule blocks (day_of_week + times, no
 * calendar date of their own) onto real calendar dates within a range —
 * the thing /uni/calendar was missing entirely: it only ever plotted
 * assessments and deadlines (both already have a real due_at), so a
 * recurring lecture had no way to show up on the calendar at all,
 * regardless of how much schedule data existed. Pure and local-date-based
 * (getFullYear/getMonth/getDate, not UTC) to match how uni-calendar.tsx's
 * own month grid and "isToday" check already work — mixing UTC and local
 * day math here would silently shift which date a Tuesday lecture lands
 * on for anyone not in UTC.
 */

export interface WeeklyOccurrenceInput {
  day_of_week: number; // 0 = Sunday .. 6 = Saturday, matches Date#getDay()
}

export interface DatedOccurrence<T> {
  /** YYYY-MM-DD, local calendar date. */
  date: string;
  item: T;
}

function dayKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Both bounds inclusive. Time-of-day on rangeStart/rangeEnd is ignored — only the calendar date matters. */
export function expandWeeklyOccurrences<T extends WeeklyOccurrenceInput>(items: T[], rangeStart: Date, rangeEnd: Date): DatedOccurrence<T>[] {
  const results: DatedOccurrence<T>[] = [];
  if (items.length === 0) return results;

  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());
  if (cursor > end) return results;

  const byDow = new Map<number, T[]>();
  for (const item of items) {
    const list = byDow.get(item.day_of_week) ?? [];
    list.push(item);
    byDow.set(item.day_of_week, list);
  }

  while (cursor <= end) {
    const matches = byDow.get(cursor.getDay());
    if (matches) {
      const date = dayKeyLocal(cursor);
      for (const item of matches) results.push({ date, item });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return results;
}
