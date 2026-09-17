/**
 * Timezone and RRULE arithmetic for pushing recurring weekly blocks to
 * Google Calendar events. Everything here is pure and takes "now" as a
 * parameter (or has no time dependency at all), same convention as
 * lib/life/timetable.ts and lib/uni/timetable.ts, so it's testable without
 * a real clock.
 *
 * This app's convention (see supabase/migrations/0040's Toronto-anchored
 * timestamps) is America/Toronto throughout — every synced event uses it.
 */
export const APP_TIME_ZONE = "America/Toronto";

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/** RRULE BYDAY code for a day_of_week (0=Sunday..6=Saturday). */
export function toByDay(dayOfWeek: number): string {
  return BYDAY[dayOfWeek];
}

/**
 * The next calendar date (today counts) that falls on `dayOfWeek`, as a
 * local Date at midnight. Used to anchor a weekly-recurring event's first
 * DTSTART so the earliest instance a person sees in Google Calendar is a
 * real, correct occurrence rather than a placeholder in the past.
 */
export function nextDateForDayOfWeek(dayOfWeek: number, from: Date = new Date()): Date {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const delta = (dayOfWeek - base.getDay() + 7) % 7;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta);
}

/**
 * "HH:MM" or "HH:MM:SS" -> Google Calendar's RFC3339-without-offset
 * dateTime, paired with a separate IANA timeZone field (the format
 * Google's API expects instead of a raw UTC offset) — see buildEventBody.
 */
export function toRfc3339Local(date: Date, time: string): string {
  const [h, m, s] = time.split(":");
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${m}:${s ?? "00"}`;
}

/**
 * The actual UTC offset in minutes for a given instant in `timeZone`,
 * accounting for DST automatically (Toronto's fall-back is mid-term, so a
 * hardcoded -04:00/-05:00 would be wrong for part of any given term).
 *
 * Standard technique: format the instant in the target zone, re-parse
 * those wall-clock components as if they were UTC, and diff against the
 * real instant — the difference is exactly the zone's offset at that
 * moment.
 */
export function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * RRULE's UNTIL, in the required UTC "floating" form (YYYYMMDDTHHMMSSZ),
 * for a recurrence that should stop after `endDate` (a term_end date,
 * inclusive — the whole day). RFC5545 requires UNTIL in UTC when DTSTART
 * carries a TZID, which every event here does.
 *
 * Found in review (external audit, 2026-09-17): the first version of this
 * function built its end-of-day anchor with `new Date(y, m, d, 23, 59,
 * 59)` — the LOCAL Date constructor, which resolves against the server
 * PROCESS's own timezone, not APP_TIME_ZONE. That happened to cancel out
 * correctly when the process's TZ was UTC (true on most serverless
 * platforms, including Netlify's default) but produced a silent 5-hour
 * double-offset anywhere it wasn't — confirmed live on a dev machine
 * actually running with TZ=America/Toronto, which is exactly the kind of
 * environment difference a "works on my deploy target" fix would never
 * catch. Fixed by anchoring with Date.UTC instead: treat y/m/d/23:59:59
 * as literal UTC components first (process-TZ-independent by
 * construction), THEN look up APP_TIME_ZONE's real offset at that instant
 * and shift by it — the same technique toLocalWallClock/
 * timeZoneOffsetMinutes already use correctly elsewhere in this file.
 */
export function toRruleUntil(endDate: Date): string {
  // y/m/d/23:59:59 treated as UTC components — an arbitrary but fixed
  // anchor instant, deliberately NOT dependent on the server process's own
  // timezone (see the review note above for why that matters).
  const asIfUtc = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59));
  // APP_TIME_ZONE's actual offset at (approximately) that instant — close
  // enough for picking the right side of a DST transition, since the
  // anchor and the real Toronto end-of-day it represents are at most ~12
  // hours apart, far inside any single DST rule's stable period.
  const offsetMinutes = timeZoneOffsetMinutes(asIfUtc, APP_TIME_ZONE);
  const utc = new Date(asIfUtc.getTime() - offsetMinutes * 60_000);
  const y = utc.getUTCFullYear();
  const mo = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  const h = String(utc.getUTCHours()).padStart(2, "0");
  const mi = String(utc.getUTCMinutes()).padStart(2, "0");
  const s = String(utc.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

/**
 * An absolute instant (e.g. a timestamptz column like uni_deadlines.due_at,
 * already UTC) rendered as that same instant's local wall-clock time in
 * `timeZone` — "YYYY-MM-DDTHH:MM:SS", the form Google's API wants paired
 * with a separate timeZone field. Not a conversion of the number, a
 * re-rendering of the same instant: 18:00 UTC becomes 14:00 in Toronto
 * (EDT, -04:00) or 13:00 (EST, -05:00), whichever is in effect that day.
 */
export function toLocalWallClock(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  // en-CA's hour can come back "24" for midnight in some runtimes; normalize.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}`;
}

/** A weekly-recurring RRULE for one weekday, optionally bounded by a term end. */
export function buildWeeklyRrule(dayOfWeek: number, until?: Date | null): string {
  const base = `FREQ=WEEKLY;BYDAY=${toByDay(dayOfWeek)}`;
  return until ? `RRULE:${base};UNTIL=${toRruleUntil(until)}` : `RRULE:${base}`;
}
