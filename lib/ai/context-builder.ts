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
import { getPipelineStages, getDeals, getContracts, computeMrr } from "@/lib/db/queries/business";
import { getTodayRoutineItems } from "@/lib/db/queries/routine";

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
  ]);

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
  };
}

export type MentorContext = Awaited<ReturnType<typeof buildMentorContext>>;
