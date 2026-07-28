import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type TradeRow = Database["public"]["Tables"]["trades"]["Row"];

export async function getAccounts(supabase: Client) {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("account_type", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Ledger convention: every account's current_balance is a running total where income
 * transactions add and expense transactions subtract (see the transactions trigger).
 * For credit accounts this means current_balance goes negative as debt accrues, so a
 * plain sum across all accounts already nets assets against liabilities correctly.
 */
export function computeAssetLiabilityTotals(
  accounts: Pick<AccountRow, "current_balance" | "is_liability">[],
) {
  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    const balance = Number(a.current_balance);
    if (a.is_liability) liabilities += Math.max(0, -balance);
    else assets += balance;
  }
  return { assets, liabilities, netWorth: assets - liabilities };
}

function monthRange(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  const toStr = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toStr(start), end: toStr(end) };
}

export interface TransactionFilters {
  accountId?: string;
  category?: string;
  from?: string;
  to?: string;
}

export async function getTransactions(supabase: Client, filters: TransactionFilters = {}) {
  let query = supabase
    .from("transactions")
    .select("*")
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.from) query = query.gte("occurred_at", filters.from);
  if (filters.to) query = query.lte("occurred_at", filters.to);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getMonthTransactions(supabase: Client, reference = new Date()) {
  const { start, end } = monthRange(reference);
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .gte("occurred_at", start)
    .lt("occurred_at", end);
  if (error) throw error;
  return data;
}

export function computeMonthlyPnl(transactions: Pick<TransactionRow, "type" | "amount">[]) {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  return { income, expense, net: income - expense };
}

export function computeSpendByCategory(transactions: Pick<TransactionRow, "type" | "category" | "amount">[]) {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount));
  }
  return map;
}

const TREND_DAYS = 30;

export async function getRecentTransactions(supabase: Client, days = TREND_DAYS) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .gte("occurred_at", since.toISOString().slice(0, 10))
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  return data;
}

/** Buckets transactions into one point per day (zero-filled) for a trend chart — no gaps on days with no activity. */
export function computeDailyCashflow(transactions: Pick<TransactionRow, "type" | "amount" | "occurred_at">[], days = TREND_DAYS) {
  const byDay = new Map<string, { income: number; expense: number }>();
  for (const t of transactions) {
    const bucket = byDay.get(t.occurred_at) ?? { income: 0, expense: 0 };
    if (t.type === "income") bucket.income += Number(t.amount);
    else bucket.expense += Number(t.amount);
    byDay.set(t.occurred_at, bucket);
  }

  const points: { date: string; income: number; expense: number; net: number }[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - days + 1);
  for (let i = 0; i < days; i++) {
    const key = cursor.toISOString().slice(0, 10);
    const bucket = byDay.get(key) ?? { income: 0, expense: 0 };
    points.push({
      date: new Date(key + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      income: bucket.income,
      expense: bucket.expense,
      net: bucket.income - bucket.expense,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

export async function getBudgets(supabase: Client) {
  const { data, error } = await supabase.from("budgets").select("*").order("category", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTrades(supabase: Client) {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("status", { ascending: true })
    .order("opened_at", { ascending: false });
  if (error) throw error;
  return data;
}

export function computeTradeStats(trades: Pick<TradeRow, "status" | "pnl">[]) {
  const closed = trades.filter((t) => t.status === "closed" && t.pnl !== null);
  const wins = closed.filter((t) => Number(t.pnl) > 0);
  const totalPnl = closed.reduce((s, t) => s + Number(t.pnl), 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  return {
    totalPnl,
    winRate,
    closedCount: closed.length,
    openCount: trades.length - closed.length,
  };
}

export function computePnlBySetup(trades: Pick<TradeRow, "setup_category" | "pnl" | "status">[]) {
  const map = new Map<string, number>();
  for (const t of trades) {
    if (t.status !== "closed" || t.pnl === null) continue;
    const key = t.setup_category || "Uncategorized";
    map.set(key, (map.get(key) ?? 0) + Number(t.pnl));
  }
  return map;
}
