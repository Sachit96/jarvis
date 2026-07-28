import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function HealthSnapshotCard({
  trainedToday,
  workoutsCount,
  volume7d,
  caloriesToday,
  calorieTarget,
}: {
  trainedToday: boolean;
  workoutsCount: number;
  volume7d: number;
  caloriesToday: number;
  calorieTarget: number;
}) {
  const caloriePct = calorieTarget > 0 ? Math.round((caloriesToday / calorieTarget) * 100) : 0;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-label uppercase tracking-wide text-muted-foreground">Health Snapshot</p>
        <Link href="/health/workouts" className="text-label text-brand hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <p className={cn("font-mono text-heading", trainedToday ? "text-success" : "text-foreground")}>
            {trainedToday ? "Done" : "Not yet"}
          </p>
          <p className="text-caption text-muted-foreground">Trained today</p>
        </div>
        <div>
          <p className="font-mono text-heading text-foreground">{volume7d.toLocaleString()} kg</p>
          <p className="text-caption text-muted-foreground">Volume (7d) · {workoutsCount} sessions</p>
        </div>
        <div>
          <p className={cn("font-mono text-heading", caloriePct > 100 ? "text-danger" : "text-foreground")}>
            {caloriesToday.toLocaleString()}
          </p>
          <p className="text-caption text-muted-foreground">{caloriePct}% of {calorieTarget.toLocaleString()} kcal</p>
        </div>
      </div>
    </Card>
  );
}
