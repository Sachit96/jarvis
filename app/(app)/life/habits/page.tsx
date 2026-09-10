import { Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getHabits, getHabitLogsForHeatmap } from "@/lib/db/queries/life";
import { getTodayRoutineItems } from "@/lib/db/queries/routine";
import { ensureDefaultHabitsAction } from "@/actions/life-actions";
import { HabitForm } from "@/components/life/habit-form";
import { HabitCard } from "@/components/life/habit-card";
import { AutoRoutineList } from "@/components/life/auto-routine-list";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { TASKS_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default async function RoutinePage() {
  await ensureDefaultHabitsAction();

  const supabase = await createClient();
  const habits = await getHabits(supabase);
  const [logs, routineItems] = await Promise.all([
    getHabitLogsForHeatmap(
      supabase,
      habits.map((h) => h.id),
    ),
    getTodayRoutineItems(supabase),
  ]);

  const datesByHabit = new Map<string, string[]>();
  for (const log of logs) {
    if (!log.completed) continue;
    const list = datesByHabit.get(log.habit_id) ?? [];
    list.push(log.log_date);
    datesByHabit.set(log.habit_id, list);
  }

  const autoItems = routineItems.filter((i) => i.kind === "auto");
  const noG = habits.filter((h) => h.metric_type === "no_g");
  const rest = habits.filter((h) => h.metric_type !== "no_g");
  const orderedHabits = [...noG, ...rest];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader eyebrow="Life" title="Routine" />
        <HabitForm />
      </div>

      <ModuleTabs tabs={TASKS_TABS} />

      <AutoRoutineList items={autoItems} />

      {orderedHabits.length > 0 ? (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {orderedHabits.map((habit) => (
            <HabitCard key={habit.id} habit={habit} completedDates={datesByHabit.get(habit.id) ?? []} />
          ))}
        </div>
      ) : null}

      {habits.length === 0 ? (
        <div className="surface">
          <EmptyState icon={Repeat} title="No routine yet" description="Add the things you want to do every day and they will appear on Home each morning." />
        </div>
      ) : null}
    </div>
  );
}
