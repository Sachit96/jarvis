import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeStreak } from "@/lib/db/queries/life";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * A real month-grid calendar (correct day-of-week alignment, not a flat
 * row of dots) marking which days had a workout, plus the current streak —
 * reuses computeStreak (same streak logic as habits).
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
  const todayKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const cells: { key: string; day: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = new Date(year, month, d).toISOString().slice(0, 10);
    cells.push({ key, day: d });
  }

  const { current: currentStreak, best: bestStreak } = computeStreak(trainedDates);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{monthLabel}</p>
        <div className="flex items-center gap-1.5 text-xs">
          <Flame className={cn("h-3.5 w-3.5", currentStreak > 0 ? "text-warn" : "text-muted-foreground")} strokeWidth={2.25} />
          <span className="font-mono font-medium text-foreground">{currentStreak}</span>
          <span className="text-muted-foreground">day streak</span>
          {bestStreak > currentStreak ? <span className="text-muted-foreground">· best {bestStreak}</span> : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center font-mono text-[10px] text-muted-foreground/60">
            {label}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {cells.map((cell) => {
          const trained = trainedDates.has(cell.key);
          const isToday = cell.key === todayKey;
          return (
            <div
              key={cell.key}
              title={cell.key}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md font-mono text-[11px]",
                trained ? "bg-success text-white" : "bg-white/[0.04] text-muted-foreground",
                isToday && !trained && "ring-1 ring-brand",
                isToday && trained && "ring-1 ring-white/60",
              )}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
