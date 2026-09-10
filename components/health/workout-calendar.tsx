import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeStreak } from "@/lib/db/queries/life";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * A real month-grid calendar (correct day-of-week alignment, not a flat
 * row of dots) marking which days had a workout, plus the current streak —
 * reuses computeStreak (same streak logic as habits).
 *
 * Two things changed here for the visual pass, both from looking at it
 * rendered rather than at the markup:
 *
 * 1. Trained days were `bg-success` — saturated green tiles filling half a
 *    month grid, which made the loudest thing on the Health page a colour
 *    that appears nowhere else in the product. Completion now reads in the
 *    JARVIS language: a brand-tinted surface with a lit edge. Green survives
 *    only as a 4px dot, where it is a status indicator rather than a
 *    decorative fill.
 * 2. The grid was `aspect-square` across the full card width, so on a
 *    desktop the calendar alone was ~700px tall — an entire screen to say
 *    "you trained nine times". It is now a fixed-size block with the month's
 *    numbers read out beside it.
 */
export function WorkoutCalendar({ trainedDates }: { trainedDates: Set<string> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  // NOT now.toISOString().slice(0, 10) — `now` still carries the current
  // time-of-day, and that plus the UTC offset rolls into the next
  // calendar date after ~8pm Eastern (the exact bug found and fixed in
  // uni-calendar.tsx's dayKey — same root cause, different file, found by
  // grepping for the pattern rather than assuming one fix caught it all).
  // Building from local Y/M/D is correct regardless of time-of-day.
  const dayKey = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const todayKey = dayKey(now.getDate());

  const cells = Array.from({ length: daysInMonth }, (_, i) => ({ key: dayKey(i + 1), day: i + 1 }));
  const trainedThisMonth = cells.filter((c) => trainedDates.has(c.key)).length;
  const elapsed = cells.filter((c) => c.key <= todayKey).length;

  const { current: currentStreak, best: bestStreak } = computeStreak(trainedDates);

  return (
    <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
      <div className="w-full max-w-[19rem]">
        <div className="flex items-center justify-between">
          <p className="eyebrow">{monthLabel}</p>
          <div className="flex items-center gap-1.5 text-caption">
            <Flame
              className={cn("size-3.5", currentStreak > 0 ? "text-brand" : "text-foreground-tertiary")}
              strokeWidth={2.25}
            />
            <span className="tabular font-medium text-foreground">{currentStreak}</span>
            <span className="text-foreground-tertiary">day streak</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={i} className="pb-1 text-center text-[10px] tracking-widest text-foreground-tertiary/70">
              {label}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {cells.map((cell) => {
            const trained = trainedDates.has(cell.key);
            const isToday = cell.key === todayKey;
            const future = cell.key > todayKey;
            return (
              <div
                key={cell.key}
                title={`${cell.key}${trained ? " — trained" : ""}`}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-md text-[11px] tabular",
                  trained
                    ? "bg-[color-mix(in_oklab,var(--brand)_26%,transparent)] font-medium text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.14)]"
                    : future
                      ? "text-foreground-tertiary/35"
                      : "bg-white/[0.03] text-foreground-tertiary",
                  isToday && "ring-1 ring-brand ring-offset-1 ring-offset-black",
                )}
              >
                {cell.day}
                {/* Completion still gets a success signal — as an indicator,
                    not as the tile. */}
                {trained ? (
                  <span className="absolute right-1 bottom-1 size-1 rounded-full bg-success" aria-hidden />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-10 gap-y-5">
        <div>
          <dt className="eyebrow">Trained</dt>
          <dd className="tabular mt-1.5 font-display text-metric">
            {trainedThisMonth}
            <span className="text-foreground-tertiary"> / {elapsed}</span>
          </dd>
          <p className="mt-1 text-caption text-foreground-tertiary">days so far this month</p>
        </div>
        <div>
          <dt className="eyebrow">Best streak</dt>
          <dd className="tabular mt-1.5 font-display text-metric">{bestStreak}</dd>
          <p className="mt-1 text-caption text-foreground-tertiary">
            {bestStreak > currentStreak ? "Current run is shorter" : "Currently at your best"}
          </p>
        </div>
      </dl>
    </div>
  );
}
