import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/shared/progress-ring";
import type { RoutineItem } from "@/lib/db/queries/routine";

export function TodayRoutineCard({ items }: { items: RoutineItem[] }) {
  const completedCount = items.filter((i) => i.completed).length;
  const percent = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-label uppercase tracking-wide text-muted-foreground">Today&apos;s Routine</p>
        <Link href="/life/habits" className="text-label text-brand hover:underline">
          View all
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-5">
        <ProgressRing percent={percent} size={104} strokeWidth={8} label={`${completedCount}/${items.length}`} sublabel="done" />
        <ul className="min-w-0 flex-1 space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-body">
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                  item.completed ? "bg-brand text-primary-foreground" : "bg-muted",
                )}
              >
                {item.completed ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
              </span>
              <span className={cn("truncate", item.completed && "text-muted-foreground line-through")}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
