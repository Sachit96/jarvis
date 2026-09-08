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
import { KpiCell, KpiGrid } from "@/components/shared/kpi-grid";
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

  // Real per-category counts for the last 7 days — a short narrative line
  // for OverallProgressChart to fall back to when the smoothed 0-100
  // series aren't moving enough to be worth charting yet (found live,
  // 2026-09-06 audit: four near-flat lines over 30 days).
  const dealsWonThisWeek = deals.filter((d) => {
    if (!d.closed_at || new Date(d.closed_at) < sevenDaysAgo) return false;
    return stages.find((s) => s.id === d.stage_id)?.is_won;
  }).length;
  const transactionsThisWeek = monthTransactions.filter((t) => new Date(t.occurred_at) >= sevenDaysAgo).length;
  const habitsDoneToday = routineItems.filter((i) => i.completed).length;
  const progressNarrative = [
    `Business: ${dealsWonThisWeek} deal(s) won this week`,
    `Health: ${recentWorkoutIds.length} workout(s) this week`,
    `Finance: ${transactionsThisWeek} transaction(s) this week`,
    `Habits: ${habitsDoneToday}/${routineItems.length} done today`,
  ];

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
    <div className="space-y-4">
      {hasHevyKey() ? <HevyAutoSync /> : null}

      <div className="space-y-1">
        <p className="text-label uppercase tracking-wide text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="text-title">Today</h1>
      </div>

      {/* The five separate stat tiles are one fused block now. They were
          always read as a set, and five outlines at the top of the page was
          most of what made the dashboard look busy. Goal completion is the
          one that dropped: LifeScoreCard and the goals rail below both
          already carry it, where the other four have no second home. */}
      <KpiGrid columns={4}>
        <KpiCell
          label="Net worth"
          accentClassName="text-cat-money"
          value={money(financeTotals.netWorth)}
          hint={accounts.length === 0 ? "No accounts connected yet" : `Across ${accounts.length} account(s)`}
        />
        <KpiCell
          label="Business revenue"
          accentClassName="text-cat-business"
          value={money(mrr)}
          hint={`${pipelineSummary.openCount} open deal(s) · ${money(pipelineSummary.openValue)} pipeline`}
        />
        <KpiCell
          label="Health score"
          accentClassName="text-cat-health"
          value={`${lifeScore.health}`}
          hint={
            lifeScore.health === 0 && workouts.length > 0
              ? "Nothing logged today"
              : trainedToday
                ? "Trained today"
                : "No training logged today"
          }
        />
        <KpiCell
          label="Discipline"
          accentClassName="text-cat-goals"
          value={`${lifeScore.habits}`}
          hint={`${habitsDoneToday}/${routineItems.length} routine items done`}
        />
      </KpiGrid>

      {/* A plain 12-column grid on natural heights, replacing four flex
          columns that equalised against the tallest and needed a viewport
          max-height plus filler cards stretched with flex-1 to avoid voids.
          That arrangement made any one card growing drag every other column
          with it; here a tall card affects only its own row. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <OverallProgressChart points={lifeScoreTrend} narrative={progressNarrative} compact />
        </div>
        <div className="xl:col-span-4">
          <LifeScoreCard score={lifeScore} compact />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PriorityTasksWidget tasks={priorityTasks} compact />
        <TodayRoutineCard items={routineItems} compact />
        <MentorInsightCard
          markdownBody={dailyBrief?.markdown_body ?? null}
          focusAreas={dailyBrief?.focus_areas ?? []}
          compact
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UpcomingCard items={upcoming} compact />
        <GoalsRailCard goals={goals} />
        <RecentActivityCard items={recentActivity} compact />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DetailStatsCard
          title="Finance"
          compact
          footnote={accounts.length === 0 ? "No accounts connected yet" : undefined}
          rows={[
            { label: "Assets", value: money(financeTotals.assets) },
            { label: "Liabilities", value: money(financeTotals.liabilities), tone: financeTotals.liabilities > 0 ? "danger" : "neutral" },
            { label: "Income (mo)", value: money(pnl.income), tone: "success" },
            { label: "Expenses (mo)", value: money(pnl.expense), tone: "danger" },
          ]}
          footerLabel="Finance Overview"
          footerHref="/finance/overview"
        />
        <DetailStatsCard
          title="Business"
          compact
          footnote={
            pipelineSummary.openValue === 0 && pipelineSummary.openCount > 0
              ? `${pipelineSummary.openCount} deal(s), values not set yet`
              : undefined
          }
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <NotesRailCard entries={memoryEntries} />
        </div>
        <div className="xl:col-span-8">
          <HabitHeatmapCard habits={habits} datesByHabit={datesByHabit} />
        </div>
      </div>
    </div>
  );
}
