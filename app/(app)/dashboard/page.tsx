import Link from "next/link";
import { StatTile } from "@/components/shared/stat-tile";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getPriorityTasks, getHabitsWithStreaks } from "@/lib/db/queries/life";
import { getAccounts, getMonthTransactions, computeAssetLiabilityTotals, computeMonthlyPnl } from "@/lib/db/queries/finance";
import {
  getWorkouts,
  getWorkoutSets,
  getNutritionTargets,
  getNutritionLogsForDate,
  computeMacroTotals,
  computeWorkoutVolume,
} from "@/lib/db/queries/health";
import { getDailyRecommendation } from "@/lib/db/queries/mentor";
import { getContracts, computeMrr } from "@/lib/db/queries/business";
import { hasHevyKey } from "@/lib/providers/workout/hevy-client";
import { PriorityTasksWidget } from "@/components/dashboard/priority-tasks-widget";
import { HabitStreaksWidget } from "@/components/dashboard/habit-streaks-widget";
import { NetWorthWidget } from "@/components/finance/net-worth-widget";
import { MonthlyPnlCard } from "@/components/finance/monthly-pnl-card";
import { HevyAutoSync } from "@/components/health/hevy-auto-sync";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayStr();

  const [priorityTasks, habitsWithStreaks, accounts, monthTransactions, workouts, nutritionTargets, todayNutritionLogs, dailyBrief, contracts] =
    await Promise.all([
      getPriorityTasks(supabase),
      getHabitsWithStreaks(supabase),
      getAccounts(supabase),
      getMonthTransactions(supabase),
      getWorkouts(supabase),
      getNutritionTargets(supabase),
      getNutritionLogsForDate(supabase, today),
      getDailyRecommendation(supabase, today),
      getContracts(supabase),
    ]);
  const mrr = computeMrr(contracts);

  const financeTotals = computeAssetLiabilityTotals(accounts);
  const pnl = computeMonthlyPnl(monthTransactions);
  const trainedToday = workouts.some((w) => w.started_at.slice(0, 10) === today);
  const macroTotals = computeMacroTotals(todayNutritionLogs);
  const calorieTarget = nutritionTargets?.target_calories ?? 2000;
  const caloriePct = calorieTarget > 0 ? Math.round((macroTotals.calories / calorieTarget) * 100) : 0;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentWorkoutIds = workouts.filter((w) => new Date(w.started_at) >= sevenDaysAgo).map((w) => w.id);
  const recentSets = await getWorkoutSets(supabase, recentWorkoutIds);
  const volume7d = computeWorkoutVolume(recentSets);

  return (
    <div className="space-y-8">
      {hasHevyKey() ? <HevyAutoSync /> : null}

      <div>
        <h1 className="text-title">Today</h1>
        <p className="mt-0.5 text-body text-muted-foreground">Your cross-module command center.</p>
      </div>

      <Link
        href="/mentor"
        className="block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Card interactive>
          <p className="text-label uppercase tracking-wide text-brand">Mentor&apos;s take</p>
          <p className="mt-2 line-clamp-3 text-body text-muted-foreground">
            {dailyBrief ? dailyBrief.markdown_body : "No brief yet today — tap to have your mentor look things over."}
          </p>
        </Card>
      </Link>

      <NetWorthWidget {...financeTotals} />
      <MonthlyPnlCard {...pnl} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile
          label="Workouts (90d)"
          value={String(workouts.length)}
          delta={trainedToday ? "Trained today" : "Not yet today"}
          tone={trainedToday ? "success" : "neutral"}
        />
        <StatTile label="Volume (7d)" value={`${volume7d.toLocaleString()} kg`} delta="Weight × reps" />
        <StatTile
          label="Calories today"
          value={`${macroTotals.calories} kcal`}
          delta={`${caloriePct}% of target`}
          tone={caloriePct > 100 ? "danger" : "neutral"}
        />
        <StatTile label="Life" value={String(priorityTasks.length)} delta="Priority tasks" />
        <StatTile label="MRR" value={`$${mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PriorityTasksWidget tasks={priorityTasks} />
        <HabitStreaksWidget habitsWithStreaks={habitsWithStreaks} />
      </div>
    </div>
  );
}
