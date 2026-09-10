import { createClient } from "@/lib/supabase/server";
import { AuroraBackdrop } from "@/components/shell/aurora-backdrop";
import { getGoals, getTasks } from "@/lib/db/queries/life";
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
import { getCourses, getAssessments, getDeadlines } from "@/lib/db/queries/uni";
import { computeStaleDeals, getContacts } from "@/lib/db/queries/business";
import { groupTasks, selectPriorityTasks, type TaskLike } from "@/lib/life/task-views";
import { topPriority, rankPriorities } from "@/lib/life/priority";
import { JarvisPriorityCard } from "@/components/dashboard/jarvis-priority-card";
import { getLifeScoreSnapshot, getLifeScoreTrend } from "@/lib/db/queries/life-score";
import { hasHevyKey } from "@/lib/integrations/hevy/client";
import { getMemoryEntries } from "@/lib/db/queries/memory";
import { formatLbs } from "@/lib/units";
import { Briefcase, HeartPulse, ListChecks, Wallet } from "lucide-react";
import { KpiCell, KpiGrid } from "@/components/shared/kpi-grid";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
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

  // Two waves, not five. Everything independent goes in the first; the
  // second holds only what genuinely needs an id from the first (workout
  // sets, habit logs, assessments), so those three overlap rather than
  // queueing behind one another. getTasks also replaces the separate
  // getPriorityTasks call — both read the whole tasks table, and one list
  // answers both questions.
  const [
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
    uniCourses,
    uniDeadlines,
    allTasks,
    contacts,
  ] = await Promise.all([
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
    getCourses(supabase),
    getDeadlines(supabase),
    getTasks(supabase),
    getContacts(supabase),
  ]);

  const priorityTasks = selectPriorityTasks(allTasks, 4);

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

  // The only three reads that genuinely depend on the batch above, so they
  // run together rather than in three separate waves.
  //
  // 84 days = the 12 weeks HabitHeatmapCard actually renders — the Routine
  // page's own getHabitLogsForHeatmap call asks for 35 (its own narrower
  // view), so this needs its own wider window, not the default.
  const [recentSets, habitLogs, uniAssessments] = await Promise.all([
    getWorkoutSets(supabase, recentWorkoutIds),
    getHabitLogsForHeatmap(supabase, habits.map((h) => h.id), 84),
    getAssessments(supabase, uniCourses.map((c) => c.id)),
  ]);
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

  // Cross-module inputs for the JARVIS priority line reuse the same helpers
  // the University and Business pages use, so the headline cannot disagree
  // with them.
  const courseCode = new Map(uniCourses.map((c) => [c.id, c.code]));

  const groupedTasks = groupTasks(allTasks as TaskLike[], today);
  const staleDeals = computeStaleDeals(deals, stages, contacts);

  const priorityInput = {
    today,
    overdueTasks: groupedTasks.overdue.map((t) => ({ id: t.id, title: t.title, due_date: t.due_date })),
    tasksDueToday: groupedTasks.today.map((t) => ({ id: t.id, title: t.title })),
    universityDue: [
      ...uniAssessments
        .filter((a) => a.due_at && a.status !== "graded" && a.status !== "submitted")
        .map((a) => ({ id: a.id, title: a.title, due_at: a.due_at!, course: courseCode.get(a.course_id) })),
      ...uniDeadlines.map((d) => ({ id: d.id, title: d.title, due_at: d.due_at, course: null })),
    ],
    staleDeals,
    routine: {
      completed: routineItems.filter((i) => i.completed).length,
      total: routineItems.length,
    },
  };
  const ranked = rankPriorities(priorityInput);
  const priority = topPriority(priorityInput);

  const datesByHabit = new Map<string, Set<string>>();
  for (const log of habitLogs) {
    if (!log.completed) continue;
    const set = datesByHabit.get(log.habit_id) ?? new Set<string>();
    set.add(log.log_date);
    datesByHabit.set(log.habit_id, set);
  }

  return (
    <div className="space-y-8">
      {/* The shell already lights every route at ambient strength; Home is
          the command centre, so it turns the same lamps up rather than
          adding different ones. */}
      <AuroraBackdrop intensity="focal" />
      {hasHevyKey() ? <HevyAutoSync /> : null}

      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        title="Today"
      />

      {/* The page's answer, and the only lit panel on it. It and the KPI
          block are the only two things on Home that animate in — §19's
          "selectively", meant literally. */}
      <div className="rise">
        <JarvisPriorityCard priority={priority} runnersUp={ranked.slice(1, 3)} />
      </div>

      {/* One fused block. These four are always read as a set, and four
          separate outlines at the top of a dashboard is most of what makes
          one look busy. Goal completion is the figure that dropped:
          LifeScoreCard and the goals rail both already carry it. */}
      <KpiGrid columns={4} className="rise rise-delay-1">
        <KpiCell
          label="Net worth"
          icon={Wallet}
          primary
          value={money(financeTotals.netWorth)}
          hint={accounts.length === 0 ? "No accounts connected yet" : `Across ${accounts.length} account(s)`}
        />
        <KpiCell
          label="Business revenue"
          icon={Briefcase}
          value={money(mrr)}
          hint={`${pipelineSummary.openCount} open deal(s) · ${money(pipelineSummary.openValue)} pipeline`}
        />
        <KpiCell
          label="Health score"
          icon={HeartPulse}
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
          icon={ListChecks}
          value={`${lifeScore.habits}`}
          hint={`${habitsDoneToday}/${routineItems.length} routine items done`}
        />
      </KpiGrid>

      {/* Three named bands rather than eight anonymous grid rows at identical
          weight and identical spacing. The page reads top-to-bottom as: what
          is happening now, how the last month went, where each module
          stands — which is the order the questions actually arrive in. */}
      <section className="space-y-3">
        <SectionHeader title="Now" description="What today asks of you." />
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          <PriorityTasksWidget tasks={priorityTasks} compact />
          <TodayRoutineCard items={routineItems} compact />
          <MentorInsightCard
            markdownBody={dailyBrief?.markdown_body ?? null}
            focusAreas={dailyBrief?.focus_areas ?? []}
            compact
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Momentum" description="The last thirty days, and where each area sits." />
        {/* A plain 12-column grid on natural heights, replacing four flex
            columns that equalised against the tallest and needed a viewport
            max-height plus filler cards stretched with flex-1 to avoid voids.
            That arrangement made any one card growing drag every other column
            with it; here a tall card affects only its own row. */}
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <OverallProgressChart points={lifeScoreTrend} narrative={progressNarrative} compact elevated />
          </div>
          <div className="xl:col-span-4">
            <LifeScoreCard score={lifeScore} compact />
          </div>
        </div>
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UpcomingCard items={upcoming} compact />
          <GoalsRailCard goals={goals} />
          <RecentActivityCard items={recentActivity} compact />
        </div>
      </section>

      <SectionHeader title="Modules" description="A line each, and a way in." />

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DetailStatsCard
          title="Finance"
          compact
          footnote={accounts.length === 0 ? "No accounts connected yet" : undefined}
          rows={[
            { label: "Assets", value: money(financeTotals.assets) },
            { label: "Liabilities", value: money(financeTotals.liabilities), tone: financeTotals.liabilities > 0 ? "danger" : "neutral" },
            // Tone only when there is something to tone. A green $0 income
            // and a red $0 expense on a first-run dashboard dress an absence
            // up as a reading.
            { label: "Income (mo)", value: money(pnl.income), tone: pnl.income > 0 ? "success" : "neutral" },
            { label: "Expenses (mo)", value: money(pnl.expense), tone: pnl.expense > 0 ? "danger" : "neutral" },
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

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
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
