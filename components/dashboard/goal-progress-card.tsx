import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Database } from "@/lib/supabase/database.types";

type Goal = Database["public"]["Tables"]["goals"]["Row"];

export function GoalProgressCard({ goals }: { goals: Goal[] }) {
  const active = goals.filter((g) => g.status === "active").slice(0, 4);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-label uppercase tracking-wide text-muted-foreground">Goal Progress</p>
        <Link href="/life/goals" className="text-label text-brand hover:underline">
          View all
        </Link>
      </div>
      {active.length === 0 ? (
        <p className="mt-3 text-body text-muted-foreground">No active goals yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {active.map((goal) => (
            <li key={goal.id}>
              <div className="flex items-center justify-between text-body">
                <span className="truncate">{goal.title}</span>
                <span className="shrink-0 font-mono text-caption text-brand">{goal.progress_percent}%</span>
              </div>
              <Progress value={goal.progress_percent} className="mt-1 h-1.5" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
