import { createClient } from "@/lib/supabase/server";
import { getHabits, getHabitLogsForHeatmap } from "@/lib/db/queries/life";
import { ensureDefaultHabitsAction } from "@/actions/life-actions";
import { HabitForm } from "@/components/life/habit-form";
import { HabitCard } from "@/components/life/habit-card";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { GOALS_TABS } from "@/lib/nav-items";

export default async function HabitsPage() {
  await ensureDefaultHabitsAction();

  const supabase = await createClient();
  const habits = await getHabits(supabase);
  const logs = await getHabitLogsForHeatmap(
    supabase,
    habits.map((h) => h.id),
  );

  const datesByHabit = new Map<string, string[]>();
  for (const log of logs) {
    if (!log.completed) continue;
    const list = datesByHabit.get(log.habit_id) ?? [];
    list.push(log.log_date);
    datesByHabit.set(log.habit_id, list);
  }

  const noG = habits.filter((h) => h.metric_type === "no_g");
  const rest = habits.filter((h) => h.metric_type !== "no_g");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Life</p>
          <h1 className="text-xl font-semibold">Discipline &amp; Habits</h1>
        </div>
        <HabitForm />
      </div>

      <ModuleTabs tabs={GOALS_TABS} />

      {noG.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {noG.map((habit) => (
            <HabitCard key={habit.id} habit={habit} completedDates={datesByHabit.get(habit.id) ?? []} />
          ))}
        </div>
      ) : null}

      {rest.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {rest.map((habit) => (
            <HabitCard key={habit.id} habit={habit} completedDates={datesByHabit.get(habit.id) ?? []} />
          ))}
        </div>
      ) : null}

      {habits.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No habits yet — add your first one above.
        </p>
      ) : null}
    </div>
  );
}
