"use client";

import { useMemo, useState } from "react";
import { ListChecks, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TaskItem } from "@/components/life/task-item";
import { cn } from "@/lib/utils";
import {
  BUCKET_LABEL,
  collectTags,
  filterTasks,
  groupTasks,
  type TaskBucket,
  type TaskLike,
} from "@/lib/life/task-views";
import type { Database } from "@/lib/supabase/database.types";
import { EmptyState } from "@/components/shared/empty-state";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

/**
 * The Tasks list, grouped by when work is actually due.
 *
 * The page previously rendered one flat "active" list plus a "done" list,
 * which answers "what exists" but not "what do I need to do" — the question
 * the module is for. Overdue work sat interleaved with things due next
 * month.
 *
 * Grouping, search and filtering are all client-side over the rows the
 * server already sent. For a personal backlog of tens-to-hundreds of tasks
 * that is instant and needs no round trip per keystroke; the pure helpers in
 * lib/life/task-views.ts are shared with the AI tools, so JARVIS's idea of
 * "overdue" and this page's are the same by construction.
 */

/** Done is rendered last and collapsed, so finished work never pushes live work down. */
const ORDER: TaskBucket[] = ["overdue", "today", "upcoming", "someday", "done"];

const BUCKET_TONE: Partial<Record<TaskBucket, string>> = {
  overdue: "text-danger",
  today: "text-brand",
};

export function TaskBoard({ tasks, today }: { tasks: Task[]; today: string }) {
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low" | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const tags = useMemo(() => collectTags(tasks as TaskLike[]), [tasks]);

  const grouped = useMemo(
    () =>
      groupTasks(
        filterTasks(tasks as TaskLike[], {
          query,
          priority: priority ?? undefined,
          tag: tag ?? undefined,
        }),
        today,
      ),
    [tasks, query, priority, tag, today],
  );

  const visibleCount = ORDER.filter((b) => b !== "done").reduce((n, b) => n + grouped[b].length, 0);
  const isFiltered = Boolean(query || priority || tag);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="pl-8"
            aria-label="Search tasks"
          />
        </div>

        {(["high", "medium", "low"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPriority(priority === p ? null : p)}
            aria-pressed={priority === p}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-caption capitalize ring-1 transition-colors",
              priority === p
                ? "bg-brand/15 text-brand ring-brand/40"
                : "text-muted-foreground ring-border hover:text-foreground",
            )}
          >
            {p}
          </button>
        ))}

        {isFiltered ? (
          <button
            onClick={() => {
              setQuery("");
              setPriority(null);
              setTag(null);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-caption text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
            Clear
          </button>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <button key={t} onClick={() => setTag(tag === t ? null : t)} aria-pressed={tag === t}>
              <Badge variant={tag === t ? "default" : "outline"}>{t}</Badge>
            </button>
          ))}
        </div>
      ) : null}

      {visibleCount === 0 ? (
        <div className="surface">
        <EmptyState icon={ListChecks} title="Nothing on the list" description="Add a task above and it will be sorted into today, upcoming and overdue for you." />
      </div>
      ) : (
        ORDER.filter((b) => b !== "done").map((bucket) =>
          grouped[bucket].length === 0 ? null : (
            <section key={bucket} className="space-y-2">
              <h2 className={cn("text-heading", BUCKET_TONE[bucket] ?? "text-muted-foreground")}>
                {BUCKET_LABEL[bucket]}
                <span className="ml-1.5 text-caption font-normal text-muted-foreground">
                  {grouped[bucket].length}
                </span>
              </h2>
              <ul className="space-y-2">
                {grouped[bucket].map((task) => (
                  <TaskItem key={task.id} task={task as Task} />
                ))}
              </ul>
            </section>
          ),
        )
      )}

      {grouped.done.length > 0 ? (
        <section className="space-y-2">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="text-heading text-muted-foreground hover:text-foreground"
            aria-expanded={showDone}
          >
            {BUCKET_LABEL.done}
            <span className="ml-1.5 text-caption font-normal">{grouped.done.length}</span>
          </button>
          {showDone ? (
            <ul className="space-y-2">
              {grouped.done.map((task) => (
                <TaskItem key={task.id} task={task as Task} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
