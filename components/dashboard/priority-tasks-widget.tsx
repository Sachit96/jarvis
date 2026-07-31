import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-danger",
  medium: "bg-warn",
  low: "bg-muted-foreground",
};

export function PriorityTasksWidget({ tasks, compact = false, className }: { tasks: Task[]; compact?: boolean; className?: string }) {
  return (
    <Card padding={compact ? "compact" : "default"} className={cn("min-h-[170px]", className)}>
      <header className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Priority tasks</p>
        <Link href="/life/tasks" className="text-[13px] font-medium text-brand hover:underline">
          View all
        </Link>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        {tasks.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nothing outstanding — nice.</p>
        ) : (
          <ul className="-mx-2">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]">
                <span className="mt-1.5 flex h-1.5 w-1.5 shrink-0 items-center justify-center">
                  <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[task.priority])} />
                  <span className="sr-only">{task.priority} priority</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px]">{task.title}</p>
                  {task.due_date ? (
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{task.due_date}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
