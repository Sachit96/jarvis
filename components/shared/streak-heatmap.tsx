import { cn } from "@/lib/utils";

interface StreakHeatmapProps {
  /** ISO date strings (yyyy-mm-dd) the habit was completed on. */
  completedDates: Set<string>;
  days?: number;
}

/** A lightweight last-N-days grid — filled cyan squares for completed days. */
export function StreakHeatmap({ completedDates, days = 35 }: StreakHeatmapProps) {
  const cells: { key: string; completed: boolean; isToday: boolean }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ key, completed: completedDates.has(key), isToday: i === 0 });
  }

  return (
    <div className="grid grid-cols-7 gap-1" aria-label="Streak history">
      {cells.map((cell) => (
        <div
          key={cell.key}
          title={cell.key}
          className={cn(
            "h-3 w-3 rounded-sm",
            cell.completed ? "bg-brand" : "bg-muted",
            cell.isToday && "ring-1 ring-brand ring-offset-1 ring-offset-card",
          )}
        />
      ))}
    </div>
  );
}
