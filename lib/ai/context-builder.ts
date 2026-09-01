import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getPriorityTasks, getJournalEntries } from "@/lib/db/queries/life";
import {
  getAccounts,
  computeAssetLiabilityTotals,
  getMonthTransactions,
  computeMonthlyPnl,
  getTrades,
  computeTradeStats,
} from "@/lib/db/queries/finance";
import { getNutritionTargets, getNutritionLogsForDate, computeMacroTotals, getWorkouts } from "@/lib/db/queries/health";
import {
  getPipelineStages,
  getDeals,
  getContracts,
  getContacts,
  getAllActivities,
  computeMrr,
  computeStaleDeals,
  computeStaleContacts,
} from "@/lib/db/queries/business";
import { getTodayRoutineItems } from "@/lib/db/queries/routine";
import { getCourses, getAssessments } from "@/lib/db/queries/uni";
import { courseGrade, riskScore, findOverloadedWeeks } from "@/lib/uni/grades";

type Client = SupabaseClient<Database>;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Aggregates a snapshot across every module for the AI Mentor to reason over. */
export async function buildMentorContext(supabase: Client) {
  const today = todayStr();

  const [
    priorityTasks,
    routineItems,
    journalEntries,
    accounts,
    monthTransactions,
    trades,
    nutritionTargets,
    todayNutritionLogs,
    workouts,
    stages,
    deals,
    contracts,
    contacts,
    activities,
    courses,
  ] = await Promise.all([
    getPriorityTasks(supabase, 10),
    getTodayRoutineItems(supabase),
    getJournalEntries(supabase),
    getAccounts(supabase),
    getMonthTransactions(supabase),
    getTrades(supabase),
    getNutritionTargets(supabase),
    getNutritionLogsForDate(supabase, today),
    getWorkouts(supabase),
    getPipelineStages(supabase),
    getDeals(supabase),
    getContracts(supabase),
    getContacts(supabase),
    getAllActivities(supabase),
    // Degrades to [] rather than throwing if migration 0021 hasn't run yet
    // (matches this codebase's established convention — see
    // gemini-usage.ts's isMissingUsageTracking) — the brief just omits the
    // academics section instead of failing the whole context build.
    getCourses(supabase).catch(() => []),
  ]);
  const assessments = courses.length > 0 ? await getAssessments(supabase, courses.map((c) => c.id)).catch(() => []) : [];

  const financeTotals = computeAssetLiabilityTotals(accounts);
  const pnl = computeMonthlyPnl(monthTransactions);
  const tradeStats = computeTradeStats(trades);
  const macroTotals = computeMacroTotals(todayNutritionLogs);
  const trainedToday = workouts.some((w) => w.started_at.slice(0, 10) === today);

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const openDeals = deals.filter((d) => {
    const stage = stageById.get(d.stage_id);
    return stage && !stage.is_won && !stage.is_lost;
  });
  const wonDeals = deals.filter((d) => stageById.get(d.stage_id)?.is_won);
  const mrr = computeMrr(contracts);
  const staleDeals = computeStaleDeals(deals, stages, contacts);
  const staleContacts = computeStaleContacts(contacts, activities);

  // Academic risk engine (Work Order 3) — pure functions from
  // lib/uni/grades.ts, no LLM call here; this rides along on the existing
  // daily brief request rather than adding one, same principle as B3.
  const coursesWithRisk = courses.map((c) => {
    const courseAssessments = assessments.filter((a) => a.course_id === c.id);
    return { code: c.code, grade: courseGrade(courseAssessments), target: c.target_grade, risk: riskScore(c, courseAssessments) };
  });
  const overloadedWeeks = findOverloadedWeeks(
    assessments.map((a) => ({ ...a, title: a.title, courseCode: courses.find((c) => c.id === a.course_id)?.code ?? "?" })),
  );

  return {
    today,
    life: {
      priorityTasks: priorityTasks.map((t) => ({ title: t.title, priority: t.priority, due_date: t.due_date })),
      dailyRoutineToday: routineItems.map((item) => ({
        item: item.label,
        completedToday: item.completed,
        currentStreak: item.streak?.current,
      })),
      recentMoods: journalEntries
        .slice(0, 7)
        .map((j) => j.mood)
        .filter((m): m is number => m !== null),
    },
    finance: {
      netWorth: financeTotals.netWorth,
      monthlyIncome: pnl.income,
      monthlyExpense: pnl.expense,
      monthlyNetCashflow: pnl.net,
      openTradesCount: tradeStats.openCount,
      tradeWinRatePercent: Math.round(tradeStats.winRate),
      tradeTotalPnl: tradeStats.totalPnl,
    },
    health: {
      trainedToday,
      workoutsInLast90Days: workouts.length,
      caloriesLoggedToday: macroTotals.calories,
      calorieTarget: nutritionTargets?.target_calories ?? null,
    },
    business: {
      openPipelineDealsCount: openDeals.length,
      openPipelineValue: openDeals.reduce((sum, d) => sum + Number(d.value), 0),
      wonDealsAllTime: wonDeals.length,
      monthlyRecurringRevenue: mrr,
    },
    // Follow-up watchdog (Work Order B3) — mechanically computed (a SQL-shaped
    // query, not a model call), so the daily brief/weekly review/general chat
    // can surface it unprompted rather than the user having to remember to
    // check the pipeline for things that quietly stopped moving.
    followUps: {
      staleDeals: staleDeals.map((d) => ({ label: d.label, daysSinceStageChange: d.daysSinceStageChange })),
      staleContacts: staleContacts.map((c) => ({ label: c.label, daysSinceLastActivity: c.daysSinceLastActivity })),
    },
    // UniOS academics (Work Order 3) — empty arrays if no courses exist yet
    // or migration 0021 hasn't run, not an error.
    uni: {
      courses: coursesWithRisk,
      overloadedWeeks: overloadedWeeks.map((w) => ({ windowStart: w.windowStart, items: w.items.map((i) => `${i.courseCode} ${i.title}`) })),
    },
  };
}

export type MentorContext = Awaited<ReturnType<typeof buildMentorContext>>;
