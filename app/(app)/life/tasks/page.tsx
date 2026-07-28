import { createClient } from "@/lib/supabase/server";
import { getTasks } from "@/lib/db/queries/life";
import { TaskForm } from "@/components/life/task-form";
import { TaskItem } from "@/components/life/task-item";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { TASKS_TABS } from "@/lib/nav-items";

export default async function TasksPage() {
  const supabase = await createClient();
  const tasks = await getTasks(supabase);

  const active = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Life</p>
          <h1 className="text-xl font-semibold">Tasks</h1>
        </div>
        <TaskForm />
      </div>

      <ModuleTabs tabs={TASKS_TABS} />

      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No tasks yet — add your first one above.
        </p>
      ) : (
        <>
          {active.length > 0 ? (
            <ul className="space-y-2">
              {active.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing active — nice.</p>
          )}

          {done.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Done</p>
              <ul className="space-y-2">
                {done.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
