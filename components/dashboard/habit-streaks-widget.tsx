import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
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
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-label uppercase tracking-wide text-muted-foreground">Habit streaks</p>
        <Link href="/life/habits" className="text-label text-brand hover:underline">
          View all
        </Link>
      </div>
      {sorted.length === 0 ? (
        <p className="mt-3 text-body text-muted-foreground">No habits yet — start one to see your streak here.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {sorted.slice(0, 5).map(({ habit, streak }) => (
            <li key={habit.id} className="flex items-center justify-between text-body">
              <span className={cn("truncate", habit.metric_type === "no_g" && "text-brand")}>{habit.name}</span>
              <span className="shrink-0 font-mono text-caption text-muted-foreground">
                {streak.current}d <span className="text-muted-foreground/60">(best {streak.best}d)</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
