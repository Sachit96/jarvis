"use server";

import { createClient } from "@/lib/supabase/server";

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  updatedAt: string;
}

export interface SearchGroup {
  key: string;
  label: string;
  items: SearchResult[];
  total: number;
}

export interface GlobalSearchResponse {
  groups: SearchGroup[];
}

const RESULTS_PER_GROUP = 5;

function money(n: number) {
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Every DB-backed source searched by the palette, as a single declarative table — adding a new
 *  searchable module just means adding one entry here (query + row -> SearchResult mapping). */
async function searchAllSources(query: string | null) {
  const supabase = await createClient();
  const like = query ? `%${query}%` : null;

  function ilikeOrAll(col: string) {
    return like ? { column: col, pattern: like } : null;
  }

  const [goalsRes, tasksRes, habitsRes, journalRes, txRes, memoryRes] = await Promise.all([
    (() => {
      let q = supabase.from("goals").select("id, title, progress_percent, timeframe, updated_at").order("updated_at", { ascending: false });
      const f = ilikeOrAll("title");
      if (f) q = q.ilike(f.column, f.pattern);
      return q.limit(query ? RESULTS_PER_GROUP + 20 : RESULTS_PER_GROUP);
    })(),
    (() => {
      let q = supabase.from("tasks").select("id, title, status, due_date, updated_at").order("updated_at", { ascending: false });
      const f = ilikeOrAll("title");
      if (f) q = q.ilike(f.column, f.pattern);
      return q.limit(query ? RESULTS_PER_GROUP + 20 : RESULTS_PER_GROUP);
    })(),
    (() => {
      let q = supabase.from("habits").select("id, name, updated_at").eq("is_active", true).order("updated_at", { ascending: false });
      const f = ilikeOrAll("name");
      if (f) q = q.ilike(f.column, f.pattern);
      return q.limit(query ? RESULTS_PER_GROUP + 20 : RESULTS_PER_GROUP);
    })(),
    (() => {
      let q = supabase.from("journal_entries").select("id, title, entry_date, updated_at").order("updated_at", { ascending: false });
      const f = ilikeOrAll("title");
      if (f) q = q.ilike(f.column, f.pattern);
      return q.limit(query ? RESULTS_PER_GROUP + 20 : RESULTS_PER_GROUP);
    })(),
    (() => {
      let q = supabase
        .from("transactions")
        .select("id, description, category, amount, updated_at")
        .order("updated_at", { ascending: false });
      const f = ilikeOrAll("description");
      if (f) q = q.ilike(f.column, f.pattern);
      return q.limit(query ? RESULTS_PER_GROUP + 20 : RESULTS_PER_GROUP);
    })(),
    (() => {
      let q = supabase
        .from("memory_entries")
        .select("id, type, title, body, tags, updated_at")
        .order("updated_at", { ascending: false });
      if (query) q = q.or(`title.ilike.${like},body.ilike.${like}`);
      return q.limit(query ? RESULTS_PER_GROUP + 20 : RESULTS_PER_GROUP);
    })(),
  ]);

  // Today's completion state for whichever habits matched, for the subtitle.
  const habitIds = (habitsRes.data ?? []).map((h) => h.id);
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayLogs } = habitIds.length
    ? await supabase.from("habit_logs").select("habit_id, completed").in("habit_id", habitIds).eq("log_date", today)
    : { data: [] as { habit_id: string; completed: boolean }[] };
  const completedToday = new Set((todayLogs ?? []).filter((l) => l.completed).map((l) => l.habit_id));

  const goals: SearchResult[] = (goalsRes.data ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    subtitle: `${g.progress_percent}% · ${g.timeframe}`,
    href: "/life/goals",
    updatedAt: g.updated_at,
  }));
  const tasks: SearchResult[] = (tasksRes.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    subtitle: t.due_date ? `${t.status} · due ${t.due_date}` : t.status,
    href: "/life/tasks",
    updatedAt: t.updated_at,
  }));
  const habits: SearchResult[] = (habitsRes.data ?? []).map((h) => ({
    id: h.id,
    title: h.name,
    subtitle: completedToday.has(h.id) ? "Done today" : "Not done today",
    href: "/life/habits",
    updatedAt: h.updated_at,
  }));
  const memoryEntries: SearchResult[] = (memoryRes.data ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    subtitle: m.type,
    href: "/memory",
    updatedAt: m.updated_at,
  }));
  const journal: SearchResult[] = (journalRes.data ?? []).map((j) => ({
    id: j.id,
    title: j.title ?? "Untitled entry",
    subtitle: j.entry_date,
    href: "/life/journal",
    updatedAt: j.updated_at,
  }));
  const finance: SearchResult[] = (txRes.data ?? []).map((t) => ({
    id: t.id,
    title: t.description ?? t.category,
    subtitle: `${money(t.amount)} · ${t.category}`,
    href: "/finance/transactions",
    updatedAt: t.updated_at,
  }));

  return { goals, tasks, habits, memoryEntries, journal, finance };
}

export async function globalSearchAction(query: string): Promise<GlobalSearchResponse> {
  const q = query.trim();
  const { goals, tasks, habits, memoryEntries, journal, finance } = await searchAllSources(q.length >= 2 ? q : null);

  function group(key: string, label: string, items: SearchResult[]): SearchGroup {
    return { key, label, items: items.slice(0, RESULTS_PER_GROUP), total: items.length };
  }

  return {
    groups: [
      group("goals", "Goals", goals),
      group("tasks", "Tasks", tasks),
      group("habits", "Habits / Routine", habits),
      group("journal", "Notes", journal),
      group("memory", "Memory", memoryEntries),
      group("finance", "Finance", finance),
    ],
  };
}

/** Empty-query state: the 5 most recently modified items across every source, sorted together. */
export async function getRecentSearchItemsAction(): Promise<SearchResult[]> {
  const { goals, tasks, habits, memoryEntries, journal, finance } = await searchAllSources(null);
  const all = [...goals, ...tasks, ...habits, ...memoryEntries, ...journal, ...finance];
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
}
