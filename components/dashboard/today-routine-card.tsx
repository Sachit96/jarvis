import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/shared/progress-ring";
import type { RoutineItem } from "@/lib/db/queries/routine";

/** Column 2 filler — every habit, not a truncated preview, so this card absorbs whatever vertical space its column has to spare. */
export function TodayRoutineCard({ items, compact = false, className }: { items: RoutineItem[]; compact?: boolean; className?: string }) {
  const completedCount = items.filter((i) => i.completed).length;
  const percent = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  return (
    <Card padding={compact ? "compact" : "default"} className={cn("min-h-0", className)}>
      <header className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Today&apos;s Routine</p>
        <Link href="/life/habits" className="text-[13px] font-medium text-brand hover:underline">
          View all
        </Link>
      </header>

      <div className={cn("flex min-h-0 flex-1 items-start", compact ? "gap-2.5" : "gap-5")}>
        <ProgressRing
          percent={percent}
          size={56}
          strokeWidth={compact ? 6 : 8}
          label={`${completedCount}/${items.length}`}
          sublabel={compact ? undefined : "Completed"}
          colorClassName="stroke-success"
        />
        <ul className={cn("min-w-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", compact ? "space-y-1" : "space-y-1.5")}>
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-[13px]">
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                  item.completed ? "bg-success text-white" : "bg-muted",
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
