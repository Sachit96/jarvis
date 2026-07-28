import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoutineItem } from "@/lib/db/queries/routine";

/** Read-only — these reflect real data tracked elsewhere (workouts, nutrition, tasks, the daily brief, journal), not a separate manual toggle. */
export function AutoRoutineList({ items }: { items: RoutineItem[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Auto-tracked today</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        These check themselves off from what you&apos;ve already logged elsewhere in JARVIS.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2.5 text-sm">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                item.completed ? "bg-brand text-primary-foreground" : "bg-muted",
              )}
            >
              {item.completed ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            <span className={cn(item.completed && "text-muted-foreground line-through")}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
