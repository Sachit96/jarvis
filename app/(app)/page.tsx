import { createClient } from "@/lib/supabase/server";
import { getPriorityTasks, getGoals } from "@/lib/db/queries/life";
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
import { getPipelineStages, getDeals, getContracts, computeMrr, computePipelineSummary } from "@/lib/db/queries/business";
import { getTodayRoutineItems } from "@/lib/db/queries/routine";
import { getUpcoming, getRecentActivity } from "@/lib/db/queries/command-center";
import { hasHevyKey } from "@/lib/providers/workout/hevy-client";
import { PriorityTasksWidget } from "@/components/dashboard/priority-tasks-widget";
import { TodayRoutineCard } from "@/components/dashboard/today-routine-card";
import { GoalProgressCard } from "@/components/dashboard/goal-progress-card";
import { MentorInsightCard } from "@/components/dashboard/mentor-insight-card";
import { BusinessSnapshotCard } from "@/components/dashboard/business-snapshot-card";
import { HealthSnapshotCard } from "@/components/dashboard/health-snapshot-card";
import { UpcomingCard } from "@/components/dashboard/upcoming-card";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
import { NetWorthWidget } from "@/components/finance/net-worth-widget";
import { MonthlyPnlCard } from "@/components/finance/monthly-pnl-card";
import { HevyAutoSync } from "@/components/health/hevy-auto-sync";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayStr();

  const [
    priorityTasks,
    goals,
    accounts,
    monthTransactions,
    workouts,
    nutritionTargets,
    todayNutritionLogs,
    dailyBrief,
    stages,
    deals,
    contracts,
    routineItems,
    upcoming,
    recentActivity,
  ] = await Promise.all([
    getPriorityTasks(supabase),
    getGoals(supabase),
    getAccounts(supabase),
    getMonthTransactions(supabase),
    getWorkouts(supabase),
    getNutritionTargets(supabase),
    getNutritionLogsForDate(supabase, today),
    getDailyRecommendation(supabase, today),
    getPipelineStages(supabase),
    getDeals(supabase),
    getContracts(supabase),
    getTodayRoutineItems(supabase),
    getUpcoming(supabase),
    getRecentActivity(supabase),
  ]);

  const financeTotals = computeAssetLiabilityTotals(accounts);
  const pnl = computeMonthlyPnl(monthTransactions);
  const trainedToday = workouts.some((w) => w.started_at.slice(0, 10) === today);
  const macroTotals = computeMacroTotals(todayNutritionLogs);
  const calorieTarget = nutritionTargets?.target_calories ?? 2000;
  const pipelineSummary = computePipelineSummary(deals, stages);
  const mrr = computeMrr(contracts);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentWorkoutIds = workouts.filter((w) => new Date(w.started_at) >= sevenDaysAgo).map((w) => w.id);
  const recentSets = await getWorkoutSets(supabase, recentWorkoutIds);
  const volume7d = computeWorkoutVolume(recentSets);

  return (
    <div className="space-y-6">
      {hasHevyKey() ? <HevyAutoSync /> : null}

      <div>
        <h1 className="text-title">Today</h1>
        <p className="mt-0.5 text-body text-muted-foreground">
          What you need to know and do today, in one place.
        </p>
      </div>

      <TodayRoutineCard items={routineItems} />

      <MentorInsightCard markdownBody={dailyBrief?.markdown_body ?? null} focusAreas={dailyBrief?.focus_areas ?? []} />

      <div className="grid gap-4 sm:grid-cols-2">
        <PriorityTasksWidget tasks={priorityTasks} />
        <GoalProgressCard goals={goals} />
      </div>

      <NetWorthWidget {...financeTotals} />
      <MonthlyPnlCard {...pnl} />

      <div className="grid gap-4 sm:grid-cols-2">
        <BusinessSnapshotCard
          openValue={pipelineSummary.openValue}
          openCount={pipelineSummary.openCount}
          winRate={pipelineSummary.winRate}
          mrr={mrr}
        />
        <HealthSnapshotCard
          trainedToday={trainedToday}
          workoutsCount={workouts.length}
          volume7d={volume7d}
          caloriesToday={macroTotals.calories}
          calorieTarget={calorieTarget}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <UpcomingCard items={upcoming} />
        <RecentActivityCard items={recentActivity} />
      </div>
    </div>
  );
}
