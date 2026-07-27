import { StatTile } from "@/components/shared/stat-tile";
import { createClient } from "@/lib/supabase/server";
import { getPriorityTasks, getHabitsWithStreaks } from "@/lib/db/queries/life";
import { getAccounts, getMonthTransactions, computeAssetLiabilityTotals, computeMonthlyPnl } from "@/lib/db/queries/finance";
import { getWorkouts, getNutritionTargets, getNutritionLogsForDate, computeMacroTotals } from "@/lib/db/queries/health";
import { PriorityTasksWidget } from "@/components/dashboard/priority-tasks-widget";
import { HabitStreaksWidget } from "@/components/dashboard/habit-streaks-widget";
import { NetWorthWidget } from "@/components/finance/net-worth-widget";
import { MonthlyPnlCard } from "@/components/finance/monthly-pnl-card";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayStr();

  const [priorityTasks, habitsWithStreaks, accounts, monthTransactions, workouts, nutritionTargets, todayNutritionLogs] =
    await Promise.all([
      getPriorityTasks(supabase),
      getHabitsWithStreaks(supabase),
      getAccounts(supabase),
      getMonthTransactions(supabase),
      getWorkouts(supabase),
      getNutritionTargets(supabase),
      getNutritionLogsForDate(supabase, today),
    ]);

  const financeTotals = computeAssetLiabilityTotals(accounts);
  const pnl = computeMonthlyPnl(monthTransactions);
  const trainedToday = workouts.some((w) => w.started_at.slice(0, 10) === today);
  const macroTotals = computeMacroTotals(todayNutritionLogs);
  const calorieTarget = nutritionTargets?.target_calories ?? 2000;
  const caloriePct = calorieTarget > 0 ? Math.round((macroTotals.calories / calorieTarget) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="text-sm text-muted-foreground">
          Your cross-module command center.
        </p>
      </div>

      <div className="rounded-lg border border-brand/40 bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-brand">
          Mentor&apos;s take
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Coming in Phase 5 — the AI Mentor reads every module below and
          surfaces a daily recommendation here.
        </p>
      </div>

      <NetWorthWidget {...financeTotals} />
      <MonthlyPnlCard {...pnl} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Workouts (90d)"
          value={String(workouts.length)}
          delta={trainedToday ? "Trained today" : "Not yet today"}
          tone={trainedToday ? "success" : "neutral"}
        />
        <StatTile
          label="Calories today"
          value={`${macroTotals.calories} kcal`}
          delta={`${caloriePct}% of target`}
          tone={caloriePct > 100 ? "danger" : "neutral"}
        />
        <StatTile label="Life" value={String(priorityTasks.length)} delta="Priority tasks" />
        <StatTile label="Business" value="—" delta="Phase 4" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PriorityTasksWidget tasks={priorityTasks} />
        <HabitStreaksWidget habitsWithStreaks={habitsWithStreaks} />
      </div>
    </div>
  );
}
