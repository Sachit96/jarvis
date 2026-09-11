import "server-only";
import { z } from "zod";
import {
  getAccounts,
  getMonthTransactions,
  getBudgets,
  computeAssetLiabilityTotals,
  computeMonthlyPnl,
  computeSpendByCategory,
} from "@/lib/db/queries/finance";
import {
  getDeals,
  getPipelineStages,
  getContacts,
  getContracts,
  computeMrr,
  computePipelineSummary,
} from "@/lib/db/queries/business";
import {
  getWorkouts,
  getWorkoutSets,
  getNutritionTargets,
  getNutritionLogsForDate,
  computeMacroTotals,
  computeWorkoutVolume,
} from "@/lib/db/queries/health";
import { getHevyStatus } from "@/lib/integrations/hevy";
import { todayStr } from "@/lib/date";
import { ok, type ToolDefinition } from "@/lib/ai/tools/types";

/**
 * Read tools for Finance, Business and Health.
 *
 * These reuse the same compute* helpers the pages use, so a figure the model
 * quotes is the same figure the user sees on screen. Recomputing "net worth"
 * inside the AI layer would be a second definition, free to disagree with
 * the dashboard.
 */

const empty = z.object({});

export const getFinanceSummaryTool: ToolDefinition = {
  name: "get_finance_summary",
  description:
    "Net worth, assets, liabilities, and this month's income, expenses and net. Use for 'how am I doing financially' and 'how much did I spend'.",
  domain: "finance",
  risk: "safe",
  schema: empty,
  async handler(_args, { supabase }) {
    const [accounts, monthTx] = await Promise.all([getAccounts(supabase), getMonthTransactions(supabase)]);
    const totals = computeAssetLiabilityTotals(accounts);
    const pnl = computeMonthlyPnl(monthTx);
    return ok({
      net_worth: totals.netWorth,
      assets: totals.assets,
      liabilities: totals.liabilities,
      month_income: pnl.income,
      month_expenses: pnl.expense,
      month_net: pnl.net,
      account_count: accounts.length,
      spend_by_category: Object.fromEntries(computeSpendByCategory(monthTx)),
    });
  },
};

export const getAccountsTool: ToolDefinition = {
  name: "get_accounts",
  description: "The user's financial accounts with balances and types.",
  domain: "finance",
  risk: "safe",
  schema: empty,
  async handler(_args, { supabase }) {
    const accounts = await getAccounts(supabase);
    return ok(
      accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.account_type,
        balance: Number(a.current_balance),
        is_liability: a.is_liability,
      })),
    );
  },
};

export const getBudgetStatusTool: ToolDefinition = {
  name: "get_budget_status",
  description: "Each budget category with its limit and what has been spent against it this month.",
  domain: "finance",
  risk: "safe",
  schema: empty,
  async handler(_args, { supabase }) {
    const [budgets, monthTx] = await Promise.all([getBudgets(supabase), getMonthTransactions(supabase)]);
    const spend = computeSpendByCategory(monthTx);
    return ok(
      budgets.map((b) => {
        const spent = spend.get(b.category) ?? 0;
        const limit = Number(b.monthly_limit);
        return {
          category: b.category,
          monthly_limit: limit,
          spent,
          remaining: limit - spent,
          over_budget: spent > limit,
        };
      }),
    );
  },
};

export const getBusinessPipelineTool: ToolDefinition = {
  name: "get_business_pipeline",
  description:
    "Pipeline summary — open deal value and count, win rate, MRR — plus each deal with its stage. Use for 'how is business doing'.",
  domain: "business",
  risk: "safe",
  schema: empty,
  async handler(_args, { supabase }) {
    const [stages, deals, contracts] = await Promise.all([
      getPipelineStages(supabase),
      getDeals(supabase),
      getContracts(supabase),
    ]);
    const summary = computePipelineSummary(deals, stages);
    const stageName = new Map(stages.map((s) => [s.id, s.name]));
    return ok({
      open_value: summary.openValue,
      open_count: summary.openCount,
      win_rate_percent: summary.winRate,
      mrr: computeMrr(contracts),
      deals: deals.map((d) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        stage: stageName.get(d.stage_id) ?? "unknown",
        closed_at: d.closed_at,
      })),
    });
  },
};

export const getContactsTool: ToolDefinition = {
  name: "get_contacts",
  description: "Business contacts and leads with their status.",
  domain: "business",
  risk: "safe",
  schema: empty,
  async handler(_args, { supabase }) {
    const contacts = await getContacts(supabase);
    return ok(
      contacts.map((c) => ({
        id: c.id,
        contact_person: c.contact_person,
        company_name: c.company_name,
        email: c.email,
        phone: c.phone,
        source: c.source,
      })),
    );
  },
};

export const getHealthSummaryTool: ToolDefinition = {
  name: "get_health_summary",
  description:
    "Recent training and today's nutrition — workout count and volume over the last 7 days, plus calories and macros against target.",
  domain: "health",
  risk: "safe",
  schema: empty,
  async handler(_args, { supabase }) {
    const today = todayStr();
    const [workouts, targets, todayLogs] = await Promise.all([
      getWorkouts(supabase),
      getNutritionTargets(supabase),
      getNutritionLogsForDate(supabase, today),
    ]);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentIds = workouts.filter((w) => new Date(w.started_at) >= weekAgo).map((w) => w.id);
    const sets = await getWorkoutSets(supabase, recentIds);

    return ok({
      date: today,
      workouts_last_7_days: recentIds.length,
      volume_kg_last_7_days: computeWorkoutVolume(sets),
      trained_today: workouts.some((w) => w.started_at.slice(0, 10) === today),
      last_workout: workouts[0]
        ? { label: workouts[0].session_label, started_at: workouts[0].started_at }
        : null,
      nutrition_today: computeMacroTotals(todayLogs),
      nutrition_targets: targets
        ? {
            calories: targets.target_calories,
            protein_g: targets.target_protein_g,
            carbs_g: targets.target_carbs_g,
            fat_g: targets.target_fat_g,
          }
        : null,
      // Manual logging always works; this says whether automatic sync is on,
      // so the model can explain a thin history instead of assuming the user
      // did not train. Read from the shared status system so Settings, Home
      // and the model cannot disagree about whether Hevy is connected.
      hevy_sync: getHevyStatus().state,
    });
  },
};

export const moduleReadTools = [
  getFinanceSummaryTool,
  getAccountsTool,
  getBudgetStatusTool,
  getBusinessPipelineTool,
  getContactsTool,
  getHealthSummaryTool,
];
