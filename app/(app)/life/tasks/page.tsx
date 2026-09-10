import { ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTasks } from "@/lib/db/queries/life";
import { TaskForm } from "@/components/life/task-form";
import { TaskBoard } from "@/components/life/task-board";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { TASKS_TABS } from "@/lib/nav-items";
import { todayStr } from "@/lib/date";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default async function TasksPage() {
  const supabase = await createClient();
  const tasks = await getTasks(supabase);

  // Resolved on the server so grouping does not depend on the browser's
  // clock — a device with a skewed timezone would otherwise disagree with
  // what the AI tools call overdue.
  const today = todayStr();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow="Life" title="Tasks" />
        <TaskForm />
      </div>

      <ModuleTabs tabs={TASKS_TABS} />

      {tasks.length === 0 ? (
        <div className="surface">
          <EmptyState icon={ListChecks} title="Nothing on the list" description="Add a task above and it will be sorted into today, upcoming and overdue for you." />
        </div>
      ) : (
        <TaskBoard tasks={tasks} today={today} />
      )}
    </div>
  );
}
