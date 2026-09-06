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
 *
 * This project has now hit three distinct "now" bugs, each a different
 * mechanism, same root cause — code and prose both silently assume they
 * know the current date/time instead of asking for it: (1) this file's
 * own toISOString()-vs-local bug above; (2) stale hand-typed dates
 * written into mentor-persona prose that drifted from reality as time
 * passed; (3) the SMS webhook's add_deadline tool (found live,
 * 2026-09-06) having Gemma hallucinate a training-data-era year for a
 * year-less date, fixed by anchoring the system instruction with
 * todayStr() (see app/api/sms/webhook/route.ts's buildSystemInstruction,
 * same pattern as computeLiveClockBlock in lib/ai/persona.ts). None of
 * the three were caught by a unit test — a unit test's "now" is whatever
 * the test author typed, so it can't see a real clock/calendar drift.
 * Anything that touches "now" needs a live assertion against the actual
 * current date/time, not just a unit test, before it's trusted.
 */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
