import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { todayStr } from "@/lib/date";

type Client = SupabaseClient<Database>;

export interface UpcomingItem {
  id: string;
  label: string;
  date: string;
  kind: "task" | "goal";
  href: string;
}

/** Due tasks and goal target dates, merged and sorted — the closest real substitute for a calendar since JARVIS has no events feature. */
export async function getUpcoming(supabase: Client, limit = 6): Promise<UpcomingItem[]> {
  const today = todayStr();

  const [{ data: tasks, error: taskErr }, { data: goals, error: goalErr }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date")
      .neq("status", "done")
      .not("due_date", "is", null)
      .gte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(limit),
    supabase
      .from("goals")
      .select("id, title, target_date")
      .eq("status", "active")
      .not("target_date", "is", null)
      .gte("target_date", today)
      .order("target_date", { ascending: true })
      .limit(limit),
  ]);
  if (taskErr) throw taskErr;
  if (goalErr) throw goalErr;

  const items: UpcomingItem[] = [
    ...tasks.map((t) => ({ id: t.id, label: t.title, date: t.due_date as string, kind: "task" as const, href: "/life/tasks" })),
    ...goals.map((g) => ({ id: g.id, label: g.title, date: g.target_date as string, kind: "goal" as const, href: "/life/goals" })),
  ];

  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

export interface ActivityFeedItem {
  id: string;
  label: string;
  sublabel: string;
  timestamp: string;
  href: string;
}

/** A cross-module "what just happened" feed — recent completed tasks, transactions, journal entries, trades, and business activity, merged by time. */
export async function getRecentActivity(supabase: Client, limit = 8): Promise<ActivityFeedItem[]> {
  const perSource = Math.min(limit, 5);

  const [
    { data: completedTasks, error: taskErr },
    { data: transactions, error: txErr },
    { data: journalEntries, error: journalErr },
    { data: trades, error: tradeErr },
    { data: activities, error: activityErr },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, completed_at")
      .eq("status", "done")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(perSource),
    supabase
      .from("transactions")
      .select("id, type, category, description, amount, created_at")
      .order("created_at", { ascending: false })
      .limit(perSource),
    supabase
      .from("journal_entries")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(perSource),
    supabase
      .from("trades")
      .select("id, asset_pair, direction, created_at")
      .order("created_at", { ascending: false })
      .limit(perSource),
    supabase
      .from("activities")
      .select("id, type, notes, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(perSource),
  ]);
  if (taskErr) throw taskErr;
  if (txErr) throw txErr;
  if (journalErr) throw journalErr;
  if (tradeErr) throw tradeErr;
  if (activityErr) throw activityErr;

  const items: ActivityFeedItem[] = [
    ...completedTasks.map((t) => ({
      id: `task-${t.id}`,
      label: `Completed: ${t.title}`,
      sublabel: "Task",
      timestamp: t.completed_at as string,
      href: "/life/tasks",
    })),
    ...transactions.map((t) => ({
      id: `tx-${t.id}`,
      label: t.description || t.category,
      sublabel: `${t.type === "income" ? "+" : "-"}$${Number(t.amount).toLocaleString()}`,
      timestamp: t.created_at,
      href: "/finance/transactions",
    })),
    ...journalEntries.map((j) => ({
      id: `journal-${j.id}`,
      label: j.title || "Journal entry",
      sublabel: "Journal",
      timestamp: j.created_at,
      href: "/life/journal",
    })),
    ...trades.map((t) => ({
      id: `trade-${t.id}`,
      label: `${t.direction === "long" ? "Long" : "Short"} ${t.asset_pair}`,
      sublabel: "Trade",
      timestamp: t.created_at,
      href: "/finance/trades",
    })),
    ...activities.map((a) => ({
      id: `activity-${a.id}`,
      label: a.notes,
      sublabel: a.type,
      timestamp: a.occurred_at,
      href: "/business/clients",
    })),
  ];

  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}
