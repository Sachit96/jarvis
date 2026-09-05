import { Wallet, TrendingUp, HeartPulse, Target, CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPriorityTasks, getGoals } from "@/lib/db/queries/life";
import { getAccounts, getMonthTransactions, computeAssetLiabilityTotals, computeMonthlyPnl } from "@/lib/db/queries/finance";
import { todayStr } from "@/lib/date";
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
import { getHabits, getHabitLogsForHeatmap } from "@/lib/db/queries/life";
import { getUpcoming, getRecentActivity } from "@/lib/db/queries/command-center";
import { getLifeScoreSnapshot, getLifeScoreTrend } from "@/lib/db/queries/life-score";
import { hasHevyKey } from "@/lib/providers/workout/hevy-client";
import { getMemoryEntries } from "@/lib/db/queries/memory";
import { formatLbs } from "@/lib/units";
import { StatTile } from "@/components/shared/stat-tile";
import { PriorityTasksWidget } from "@/components/dashboard/priority-tasks-widget";
import { TodayRoutineCard } from "@/components/dashboard/today-routine-card";
import { MentorInsightCard } from "@/components/dashboard/mentor-insight-card";
import { UpcomingCard } from "@/components/dashboard/upcoming-card";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
import { LifeScoreCard } from "@/components/dashboard/life-score-card";
import { OverallProgressChart } from "@/components/dashboard/overall-progress-chart";
import { DetailStatsCard } from "@/components/dashboard/detail-stats-card";
import { GoalsRailCard } from "@/components/dashboard/goals-rail-card";
import { NotesRailCard } from "@/components/dashboard/notes-rail-card";
import { HabitHeatmapCard } from "@/components/dashboard/habit-heatmap-card";
import { HevyAutoSync } from "@/components/health/hevy-auto-sync";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayStr();

  const [
    priorityTasks,
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
    lifeScore,
    lifeScoreTrend,
    goals,
    memoryEntries,
    habits,
  ] = await Promise.all([
    getPriorityTasks(supabase, 4),
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
    getUpcoming(supabase, 4),
    getRecentActivity(supabase, 4),
    getLifeScoreSnapshot(supabase),
    getLifeScoreTrend(supabase),
    getGoals(supabase),
    getMemoryEntries(supabase),
    getHabits(supabase),
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

  // 84 days = the 12 weeks HabitHeatmapCard actually renders — the Routine
  // page's own getHabitLogsForHeatmap call only asks for 35 (its own
  // narrower view), so this needs its own wider window, not the default.
  const habitLogs = await getHabitLogsForHeatmap(
    supabase,
    habits.map((h) => h.id),
    84,
  );
  const datesByHabit = new Map<string, Set<string>>();
  for (const log of habitLogs) {
    if (!log.completed) continue;
    const set = datesByHabit.get(log.habit_id) ?? new Set<string>();
    set.add(log.log_date);
    datesByHabit.set(log.habit_id, set);
  }

  return (
    <div className="flex flex-col">
      {hasHevyKey() ? <HevyAutoSync /> : null}

      <h1 className="text-title">Today</h1>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-5">
        <StatTile label="Net Worth" value={money(financeTotals.netWorth)} icon={Wallet} category="money" compact />
        <StatTile label="Business Revenue" value={money(mrr)} icon={TrendingUp} category="business" compact />
        <StatTile label="Health Score" value={`${lifeScore.health}/100`} icon={HeartPulse} category="health" compact />
        <StatTile label="Discipline Score" value={`${lifeScore.habits}/100`} icon={Target} category="goals" compact />
        <StatTile label="Goal Completion" value={`${lifeScore.goals}%`} icon={CircleCheck} category="goals" compact />
      </div>

      {/* Main dashboard — 4 column stacks. items-stretch (the grid default) equalizes
          every column to the tallest one; each column's flex-1 card absorbs the
          leftover space instead of leaving a void beneath a shorter neighbor.
          2xl:max-h caps the row itself — without it, a column whose *content*
          (not just its filler card) grows unusually tall becomes the tallest
          thing on the page and drags every other column up with it; each
          column's own overflow-y-auto children absorb the rest by scrolling. */}
      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-4 2xl:max-h-[calc(100vh-220px)]">
        {/* Column 1 */}
        <div className="flex h-full min-h-0 flex-col gap-4">
          <GoalsRailCard goals={goals} className="flex-1" />
          <NotesRailCard entries={memoryEntries} />
        </div>

        {/* Column 2 */}
        <div className="flex h-full min-h-0 flex-col gap-4">
          <OverallProgressChart points={lifeScoreTrend} compact />
          <TodayRoutineCard items={routineItems} compact className="flex-1" />
          <DetailStatsCard
            title="Finance"
            compact
            className="min-h-[190px]"
            rows={[
              { label: "Assets", value: money(financeTotals.assets) },
              { label: "Liabilities", value: money(financeTotals.liabilities), tone: financeTotals.liabilities > 0 ? "danger" : "neutral" },
              { label: "Income (mo)", value: money(pnl.income), tone: "success" },
              { label: "Expenses (mo)", value: money(pnl.expense), tone: "danger" },
            ]}
            footerLabel="Finance Overview"
            footerHref="/finance/overview"
          />
        </div>

        {/* Column 3 */}
        <div className="flex h-full min-h-0 flex-col gap-4">
          <LifeScoreCard score={lifeScore} compact />
          <MentorInsightCard
            markdownBody={dailyBrief?.markdown_body ?? null}
            focusAreas={dailyBrief?.focus_areas ?? []}
            compact
            fill
            className="flex-1"
          />
          <DetailStatsCard
            title="Business"
            compact
            className="min-h-[140px]"
            rows={[
              { label: "Open Pipeline", value: `${money(pipelineSummary.openValue)} (${pipelineSummary.openCount})` },
              { label: "Win Rate", value: `${pipelineSummary.winRate}%` },
            ]}
            footerLabel="Business Dashboard"
            footerHref="/business/dashboard"
          />
          <DetailStatsCard
            title="Health"
            compact
            className="min-h-[190px]"
            rows={[
              { label: "Trained Today", value: trainedToday ? "Yes" : "No", tone: trainedToday ? "success" : "neutral" },
              { label: "Workouts", value: String(workouts.length) },
              { label: "Volume (7d)", value: `${formatLbs(volume7d)} lbs` },
              { label: "Calories Today", value: `${macroTotals.calories.toLocaleString()} / ${calorieTarget.toLocaleString()}` },
            ]}
            footerLabel="Health"
            footerHref="/health/workouts"
          />
        </div>

        {/* Column 4 */}
        <div className="flex h-full min-h-0 flex-col gap-4">
          <PriorityTasksWidget tasks={priorityTasks} compact />
          <UpcomingCard items={upcoming} compact />
          <RecentActivityCard items={recentActivity} compact className="flex-1" />
        </div>
      </div>

      {/* Habit history — full width, below the 4-column grid, per the
          dashboard spec. HabitHeatmapCard was fully built to this spec but
          never wired in until now (Cleanup work order follow-up). */}
      <HabitHeatmapCard habits={habits} datesByHabit={datesByHabit} className="mt-4" />
    </div>
  );
}
