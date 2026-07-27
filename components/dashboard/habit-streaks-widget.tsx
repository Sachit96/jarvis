import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";

type Habit = Database["public"]["Tables"]["habits"]["Row"];

export function HabitStreaksWidget({
  habitsWithStreaks,
}: {
  habitsWithStreaks: { habit: Habit; streak: { current: number; best: number } }[];
}) {
  const sorted = [...habitsWithStreaks].sort((a, b) => {
    if (a.habit.metric_type === "no_g") return -1;
    if (b.habit.metric_type === "no_g") return 1;
    return b.streak.current - a.streak.current;
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Habit streaks</p>
        <Link href="/life/habits" className="text-xs text-brand hover:underline">
          View all
        </Link>
      </div>
      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No habits tracked yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.slice(0, 5).map(({ habit, streak }) => (
            <li key={habit.id} className="flex items-center justify-between text-sm">
              <span className={cn("truncate", habit.metric_type === "no_g" && "text-brand")}>{habit.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {streak.current}d <span className="text-muted-foreground/60">(best {streak.best}d)</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
