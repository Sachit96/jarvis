import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getPipelineStages, getDeals, getContracts, computeMrr } from "@/lib/db/queries/business";
import { getTransactions } from "@/lib/db/queries/finance";
import { getTasks } from "@/lib/db/queries/life";
import { getTodayRoutineItems } from "@/lib/db/queries/routine";
import { getNutritionLogsForDate, computeMacroTotals, getWorkouts } from "@/lib/db/queries/health";
import { getMemoryEntries } from "@/lib/db/queries/memory";
import { getGoals } from "@/lib/db/queries/life";
import { getGeminiUsageToday } from "@/lib/db/queries/gemini-usage";
import { TIER_MODEL, TIER_DAILY_LIMIT, type GeminiTier } from "@/lib/ai/providers/gemini-client";

type Client = SupabaseClient<Database>;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export interface VoiceDashboardData {
  last7Days: {
    newClientsOnboarded: number;
    mrr: number;
    cashCollected: number;
  };
  today: {
    tasksCompleted: number;
    tasksTotal: number;
    habitsCompleted: number;
    habitsTotal: number;
    caloriesLogged: number;
    workoutsToday: number;
  };
  moduleStatus: {
    memory: boolean;
    business: boolean;
    health: boolean;
    finance: boolean;
    goals: boolean;
  };
  geminiBudget: {
    tier: GeminiTier;
    model: string;
    used: number;
    limit: number;
  };
}

/**
 * Everything Voice Mode's corner panels show, in one query so the page
 * doesn't scatter a dozen ad-hoc fetches. Every number here is real — no
 * field is invented if a table is empty, it's just 0/false.
 */
export async function getVoiceDashboardData(supabase: Client): Promise<VoiceDashboardData> {
  const since7d = daysAgoIso(7);
  const today = todayStr();

  const [stages, deals, contracts, transactions, tasks, routineItems, todayLogs, workouts, memoryEntries, goals, geminiUsage] =
    await Promise.all([
      getPipelineStages(supabase),
      getDeals(supabase),
      getContracts(supabase),
      getTransactions(supabase),
      getTasks(supabase),
      getTodayRoutineItems(supabase),
      getNutritionLogsForDate(supabase, today),
      getWorkouts(supabase),
      getMemoryEntries(supabase),
      getGoals(supabase),
      getGeminiUsageToday(supabase),
    ]);

  const wonStageIds = new Set(stages.filter((s) => s.is_won).map((s) => s.id));
  const newClientsOnboarded = deals.filter(
    (d) => wonStageIds.has(d.stage_id) && d.closed_at && d.closed_at >= since7d,
  ).length;
  const mrr = computeMrr(contracts);
  const cashCollected = transactions
    .filter((t) => t.type === "income" && t.occurred_at >= since7d)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const tasksDueToday = tasks.filter((t) => t.due_date === today);
  const tasksCompleted = tasksDueToday.filter((t) => t.status === "done").length;

  const habitsCompleted = routineItems.filter((i) => i.completed).length;
  const habitsTotal = routineItems.length;

  const macroTotals = computeMacroTotals(todayLogs);
  const workoutsToday = workouts.filter((w) => w.started_at.slice(0, 10) === today).length;

  // Two independently-tracked tiers now (migration 0018) — the HUD only
  // has room for one budget row, so it shows whichever tier is closer to
  // exhaustion (highest used/limit fraction), since that's the one that
  // actually risks failing next, not necessarily the one used most often.
  const tierBudgets = (["structured", "high_volume"] as const).map((tier) => {
    const model = TIER_MODEL[tier];
    const limit = TIER_DAILY_LIMIT[tier];
    const used = geminiUsage.find((row) => row.model === model)?.requestCount ?? 0;
    return { tier, model, used, limit, fractionUsed: limit > 0 ? used / limit : 0 };
  });
  const closestToCeiling = tierBudgets.reduce((a, b) => (b.fractionUsed > a.fractionUsed ? b : a));

  return {
    last7Days: { newClientsOnboarded, mrr, cashCollected },
    today: {
      tasksCompleted,
      tasksTotal: tasksDueToday.length,
      habitsCompleted,
      habitsTotal,
      caloriesLogged: macroTotals.calories,
      workoutsToday,
    },
    moduleStatus: {
      memory: memoryEntries.length > 0,
      business: deals.length > 0 || contracts.length > 0,
      health: workouts.length > 0 || todayLogs.length > 0,
      finance: transactions.length > 0,
      goals: goals.length > 0,
    },
    geminiBudget: {
      tier: closestToCeiling.tier,
      model: closestToCeiling.model,
      used: closestToCeiling.used,
      limit: closestToCeiling.limit,
    },
  };
}
