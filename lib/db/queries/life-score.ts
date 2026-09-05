import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const TREND_DAYS = 30;
const ROLLING_WINDOW = 7;

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  // Reset to local midnight before shifting — d otherwise keeps whatever
  // time-of-day "now" happened to be, and dateKey()'s toISOString() rolls
  // that into the next calendar date once local time-of-day plus the
  // runtime's UTC offset crosses midnight (same bug found and fixed
  // elsewhere this session — every caller of daysAgo, including the
  // trend chart's own day-cursor below, inherits this fix for free).
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Every score here is derived entirely from real rows already stored by the
 * app (habit_logs, workouts, nutrition_logs, transactions, deals,
 * activities, goals) — nothing is fabricated or estimated. The exact
 * formulas:
 *
 * - Habits (daily): % of active habits marked completed that day.
 * - Health (daily): 50pts for a logged workout that day + 50pts for any
 *   nutrition logged that day (a simple, honest presence signal — JARVIS
 *   has no other daily health metric to build a richer score from yet).
 * - Business (daily): min(100, activity count that day × 20), where
 *   "activity" = a deal created, a deal won, or a CRM activity logged.
 * - Finance (daily): 50 + 50 × (net cashflow ÷ total money moved that day),
 *   so an all-income day scores 100, all-expense scores 0, break-even
 *   scores 50. Days with zero transactions carry the prior day's value
 *   forward rather than dropping to 0 (no activity isn't "bad finances").
 * - Goals has no daily history anywhere in the schema (goals.progress_percent
 *   is a current snapshot, not a log) — it's included in the *current*
 *   composite score below but deliberately NOT plotted as a 30-day trend
 *   line, since faking one would mean inventing data.
 *
 * Each daily series is smoothed with a trailing 7-day rolling average
 * (still 100% real data, just less spiky) before being returned.
 */
export interface LifeScoreTrendPoint {
  date: string;
  business: number;
  health: number;
  finance: number;
  habits: number;
}

function rollingAverage(values: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    out.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return out;
}

export async function getLifeScoreTrend(supabase: Client, days = TREND_DAYS): Promise<LifeScoreTrendPoint[]> {
  const since = daysAgo(days - 1);
  const sinceKey = dateKey(since);

  const [
    { data: habits, error: habitsErr },
    { data: habitLogs, error: habitLogsErr },
    { data: workouts, error: workoutsErr },
    { data: nutritionLogs, error: nutritionErr },
    { data: transactions, error: txErr },
    { data: deals, error: dealsErr },
    { data: activities, error: activitiesErr },
  ] = await Promise.all([
    supabase.from("habits").select("id").eq("is_active", true),
    supabase.from("habit_logs").select("habit_id, log_date, completed").gte("log_date", sinceKey),
    supabase.from("workouts").select("started_at").gte("started_at", since.toISOString()),
    supabase.from("nutrition_logs").select("logged_at").gte("logged_at", sinceKey),
    supabase.from("transactions").select("type, amount, occurred_at").gte("occurred_at", sinceKey),
    supabase.from("deals").select("created_at, closed_at, stage_id, pipeline_stages(is_won)").gte("created_at", since.toISOString()),
    supabase.from("activities").select("occurred_at").gte("occurred_at", since.toISOString()),
  ]);
  if (habitsErr) throw habitsErr;
  if (habitLogsErr) throw habitLogsErr;
  if (workoutsErr) throw workoutsErr;
  if (nutritionErr) throw nutritionErr;
  if (txErr) throw txErr;
  if (dealsErr) throw dealsErr;
  if (activitiesErr) throw activitiesErr;

  const totalHabits = habits.length;
  const habitCompletionsByDay = new Map<string, number>();
  for (const log of habitLogs) {
    if (!log.completed) continue;
    habitCompletionsByDay.set(log.log_date, (habitCompletionsByDay.get(log.log_date) ?? 0) + 1);
  }

  const workoutDays = new Set(workouts.map((w) => w.started_at.slice(0, 10)));
  const nutritionDays = new Set(nutritionLogs.map((n) => n.logged_at));

  const cashflowByDay = new Map<string, { income: number; expense: number }>();
  for (const t of transactions) {
    const bucket = cashflowByDay.get(t.occurred_at) ?? { income: 0, expense: 0 };
    if (t.type === "income") bucket.income += Number(t.amount);
    else bucket.expense += Number(t.amount);
    cashflowByDay.set(t.occurred_at, bucket);
  }

  const businessEventsByDay = new Map<string, number>();
  for (const d of deals) {
    const createdKey = d.created_at.slice(0, 10);
    businessEventsByDay.set(createdKey, (businessEventsByDay.get(createdKey) ?? 0) + 1);
    const stage = d.pipeline_stages as { is_won: boolean } | { is_won: boolean }[] | null;
    const isWon = Array.isArray(stage) ? stage[0]?.is_won : stage?.is_won;
    if (d.closed_at && isWon) {
      const closedKey = d.closed_at.slice(0, 10);
      businessEventsByDay.set(closedKey, (businessEventsByDay.get(closedKey) ?? 0) + 1);
    }
  }
  for (const a of activities) {
    const key = a.occurred_at.slice(0, 10);
    businessEventsByDay.set(key, (businessEventsByDay.get(key) ?? 0) + 1);
  }

  const rawDates: string[] = [];
  const rawHabits: number[] = [];
  const rawHealth: number[] = [];
  const rawBusiness: number[] = [];
  const rawFinance: number[] = [];

  let lastFinanceScore = 50;
  const cursor = new Date(since);
  for (let i = 0; i < days; i++) {
    const key = dateKey(cursor);
    rawDates.push(key);

    rawHabits.push(totalHabits > 0 ? ((habitCompletionsByDay.get(key) ?? 0) / totalHabits) * 100 : 0);

    const health = (workoutDays.has(key) ? 50 : 0) + (nutritionDays.has(key) ? 50 : 0);
    rawHealth.push(health);

    const events = businessEventsByDay.get(key) ?? 0;
    rawBusiness.push(Math.min(100, events * 20));

    const cash = cashflowByDay.get(key);
    if (cash && cash.income + cash.expense > 0) {
      const net = cash.income - cash.expense;
      const total = cash.income + cash.expense;
      lastFinanceScore = Math.max(0, Math.min(100, 50 + 50 * (net / total)));
    }
    rawFinance.push(lastFinanceScore);

    cursor.setDate(cursor.getDate() + 1);
  }

  const smoothHabits = rollingAverage(rawHabits, ROLLING_WINDOW);
  const smoothHealth = rollingAverage(rawHealth, ROLLING_WINDOW);
  const smoothBusiness = rollingAverage(rawBusiness, ROLLING_WINDOW);
  const smoothFinance = rollingAverage(rawFinance, ROLLING_WINDOW);

  return rawDates.map((date, i) => ({
    date,
    business: Math.round(smoothBusiness[i]),
    health: Math.round(smoothHealth[i]),
    finance: Math.round(smoothFinance[i]),
    habits: Math.round(smoothHabits[i]),
  }));
}

export interface LifeScoreSnapshot {
  overall: number;
  business: number;
  health: number;
  finance: number;
  goals: number;
  habits: number;
}

/**
 * Today's composite across all five categories (see getLifeScoreTrend's
 * doc comment for the daily formulas — this reuses the same logic for the
 * single most-recent day, plus goals, which has no daily history).
 */
export async function getLifeScoreSnapshot(supabase: Client): Promise<LifeScoreSnapshot> {
  const trend = await getLifeScoreTrend(supabase, 1);
  const today = trend[0] ?? { business: 0, health: 0, finance: 50, habits: 0 };

  const { data: goals, error: goalsErr } = await supabase
    .from("goals")
    .select("progress_percent")
    .eq("status", "active");
  if (goalsErr) throw goalsErr;
  const goalsScore = goals.length > 0 ? goals.reduce((s, g) => s + g.progress_percent, 0) / goals.length : 0;

  const categories = { business: today.business, health: today.health, finance: today.finance, goals: Math.round(goalsScore), habits: today.habits };
  const overall = Math.round(
    (categories.business + categories.health + categories.finance + categories.goals + categories.habits) / 5,
  );

  return { overall, ...categories };
}
