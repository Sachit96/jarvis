import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export async function getTasks(supabase: Client) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getGoals(supabase: Client) {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("timeframe", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getHabits(supabase: Client) {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("is_active", true)
    .order("metric_type", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

const HEATMAP_DAYS = 35;

export async function getHabitLogsForHeatmap(supabase: Client, habitIds: string[]) {
  if (habitIds.length === 0) return [];
  const since = new Date();
  since.setDate(since.getDate() - HEATMAP_DAYS);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .in("habit_id", habitIds)
    .gte("log_date", sinceStr)
    .order("log_date", { ascending: true });
  if (error) throw error;
  return data;
}

/** Consecutive-day streak ending today or yesterday (a day not yet logged doesn't break it until it's actually missed). */
export function computeStreak(logDates: Set<string>): { current: number; best: number } {
  const toKey = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let current = 0;
  const cursor = new Date(today);
  // If today isn't logged yet, start counting from yesterday so an
  // in-progress day doesn't read as a broken streak.
  if (!logDates.has(toKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (logDates.has(toKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Best streak within the fetched window (heatmap range) — a lightweight
  // approximation, not an all-time record (would need a full log scan).
  const sorted = Array.from(logDates).sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sorted) {
    const d = new Date(key + "T00:00:00Z");
    if (prev) {
      const diffDays = Math.round((d.getTime() - prev.getTime()) / 86400000);
      run = diffDays === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }
  best = Math.max(best, current);

  return { current, best };
}

export async function getJournalEntries(supabase: Client) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPrayers(supabase: Client) {
  const { data, error } = await supabase
    .from("prayers")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getPrayerLogsForDate(supabase: Client, date: string) {
  const { data, error } = await supabase
    .from("prayer_logs")
    .select("*")
    .eq("log_date", date);
  if (error) throw error;
  return data;
}

export const DEFAULT_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
