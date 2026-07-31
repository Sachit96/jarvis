import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { computeStreak } from "@/lib/db/queries/life";
import type { Database } from "@/lib/supabase/database.types";

type Habit = Database["public"]["Tables"]["habits"]["Row"];

const HEATMAP_DAYS = 84;
const MAX_ROWS = 4;

/** Full-width band below the main grid — every active habit's last 12 weeks in one glance. */
export function HabitHeatmapCard({
  habits,
  datesByHabit,
  className,
}: {
  habits: Habit[];
  datesByHabit: Map<string, Set<string>>;
  className?: string;
}) {
  const visibleHabits = habits.slice(0, MAX_ROWS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: string[] = [];
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  return (
    <Card padding="compact" className={cn("min-h-[132px] overflow-x-auto", className)}>
      <header className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Habit History — Last 12 Weeks</p>
        <Link href="/life/habits" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand hover:underline">
          Routine
          <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
        </Link>
      </header>
      {visibleHabits.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No active habits yet.</p>
      ) : (
        <div className="min-w-[480px] space-y-2">
          {visibleHabits.map((habit) => {
            const dates = datesByHabit.get(habit.id) ?? new Set<string>();
            const { current } = computeStreak(dates);
            return (
              <div key={habit.id} className="grid grid-cols-[120px_1fr] items-center gap-3">
                <div className="sticky left-0 flex min-w-0 items-center gap-1.5 text-[13px]">
                  <span className="truncate">{habit.name}</span>
                  {current > 0 ? (
                    <span className="flex shrink-0 items-center gap-0.5 font-mono tabular-nums text-brand">
                      <Flame className="h-2.5 w-2.5" /> {current}
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-flow-col auto-cols-fr gap-[3px]">
                  {days.map((day) => (
                    <div
                      key={day}
                      title={day}
                      className={cn("h-[10px] rounded-[2px]", dates.has(day) ? "bg-brand" : "bg-muted")}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
