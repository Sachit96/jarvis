"use server";

import { createClient } from "@/lib/supabase/server";

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export interface GlobalSearchResults {
  tasks: SearchResult[];
  trades: SearchResult[];
  transactions: SearchResult[];
  journal: SearchResult[];
}

const EMPTY: GlobalSearchResults = { tasks: [], trades: [], transactions: [], journal: [] };
const RESULTS_PER_TABLE = 5;

export async function globalSearchAction(query: string): Promise<GlobalSearchResults> {
  const q = query.trim();
  if (q.length < 2) return EMPTY;

  const supabase = await createClient();
  const like = `%${q}%`;

  const [tasksRes, tradesRes, txRes, journalRes] = await Promise.all([
    supabase.from("tasks").select("id, title, status").ilike("title", like).limit(RESULTS_PER_TABLE),
    supabase.from("trades").select("id, asset_pair, direction").ilike("asset_pair", like).limit(RESULTS_PER_TABLE),
    supabase
      .from("transactions")
      .select("id, description, category, amount")
      .ilike("description", like)
      .limit(RESULTS_PER_TABLE),
    supabase.from("journal_entries").select("id, title, body").ilike("title", like).limit(RESULTS_PER_TABLE),
  ]);

  return {
    tasks: (tasksRes.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      subtitle: t.status,
      href: "/life/tasks",
    })),
    trades: (tradesRes.data ?? []).map((t) => ({
      id: t.id,
      title: t.asset_pair,
      subtitle: t.direction,
      href: "/finance/trades",
    })),
    transactions: (txRes.data ?? []).map((t) => ({
      id: t.id,
      title: t.description ?? t.category,
      subtitle: `$${t.amount} · ${t.category}`,
      href: "/finance/transactions",
    })),
    journal: (journalRes.data ?? []).map((j) => ({
      id: j.id,
      title: j.title ?? "Untitled entry",
      subtitle: j.body.slice(0, 60),
      href: "/life/journal",
    })),
  };
}
