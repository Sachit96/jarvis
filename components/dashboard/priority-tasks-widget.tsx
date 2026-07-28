import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const PRIORITY_TONE: Record<string, string> = {
  high: "text-danger border-danger/40",
  medium: "text-warn border-warn/40",
  low: "text-muted-foreground border-border",
};

export function PriorityTasksWidget({ tasks }: { tasks: Task[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-label uppercase tracking-wide text-muted-foreground">Priority tasks</p>
        <Link href="/life/tasks" className="text-label text-brand hover:underline">
          View all
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="mt-3 text-body text-muted-foreground">Nothing outstanding — nice.</p>
      ) : (
        <ul className="mt-2 -mx-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-body transition-colors hover:bg-white/[0.04]"
            >
              <Badge variant="outline" className={cn("shrink-0 font-mono text-caption uppercase", PRIORITY_TONE[task.priority])}>
                {task.priority}
              </Badge>
              <span className="truncate">{task.title}</span>
              {task.due_date ? (
                <span className="ml-auto shrink-0 font-mono text-caption text-muted-foreground">{task.due_date}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
