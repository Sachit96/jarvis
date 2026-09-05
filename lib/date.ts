/**
 * "Today," as a local YYYY-MM-DD string — the one place this should be
 * computed, replacing ~22 duplicated `todayStr()` helpers across the app
 * that all wrote `new Date().toISOString().slice(0, 10)`.
 *
 * That pattern is a real bug, not a style nit: `new Date()` carries the
 * CURRENT time-of-day, and toISOString() converts to UTC before slicing —
 * once local time-of-day plus the runtime's UTC offset crosses midnight
 * (after ~8pm in an Eastern browser, or a Node process in any non-UTC
 * timezone), the UTC calendar date is already "tomorrow" while the real
 * local date is still "today." Found live (2026-09-05) in uni-calendar.tsx
 * and workout-calendar.tsx's "is this today" checks; the same mechanism
 * makes every date-only log (journal, meals, sleep, weight, workouts
 * filed by day, study sessions, habit toggles, ...) file under the wrong
 * day whenever a client or server process hits this window.
 *
 * Fix: read local Y/M/D components directly — getFullYear/getMonth/
 * getDate are already timezone-aware and never round-trip through UTC,
 * so there's no boundary left to cross.
 */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
