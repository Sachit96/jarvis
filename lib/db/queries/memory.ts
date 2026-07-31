import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { MemoryType } from "@/lib/validations/memory";
import { MEMORY_TYPES } from "@/lib/validations/memory";

type Client = SupabaseClient<Database>;
export type MemoryEntry = Database["public"]["Tables"]["memory_entries"]["Row"];

/**
 * True only until migration 0014 has been applied. Checks both the raw Postgres
 * code (42P01 = undefined_table) and PostgREST's own API-level code (PGRST205 =
 * table not in schema cache) — PostgREST returns the latter, not the former, for
 * a table that doesn't exist yet.
 */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export async function getMemoryEntries(supabase: Client): Promise<MemoryEntry[]> {
  const { data, error } = await supabase
    .from("memory_entries")
    .select("*")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return data;
}

export async function getMemoryEntry(supabase: Client, id: string): Promise<MemoryEntry | null> {
  const { data, error } = await supabase.from("memory_entries").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
  return data;
}

export interface MemoryStats {
  total: number;
  byType: Record<MemoryType, number>;
  mostRecentCapture: string | null;
}

/** Header-strip stats — computed from already-fetched rows, no separate query. */
export function computeMemoryStats(entries: MemoryEntry[]): MemoryStats {
  const byType = Object.fromEntries(MEMORY_TYPES.map((t) => [t, 0])) as Record<MemoryType, number>;
  let mostRecentCapture: string | null = null;
  for (const e of entries) {
    byType[e.type as MemoryType] = (byType[e.type as MemoryType] ?? 0) + 1;
    if (e.source === "captured" && (!mostRecentCapture || e.updated_at > mostRecentCapture)) {
      mostRecentCapture = e.updated_at;
    }
  }
  return { total: entries.length, byType, mostRecentCapture };
}
