import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isMissingRelation } from "@/lib/db/missing-relation";

type Client = SupabaseClient<Database>;

// Degrades to empty/null if migration 0023 hasn't run yet — see
// lib/db/missing-relation.ts.

export async function getScripts(supabase: Client) {
  const { data, error } = await supabase.from("yt_scripts").select("*").order("created_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

export async function getScript(supabase: Client, id: string) {
  const { data, error } = await supabase.from("yt_scripts").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  return data;
}

/** Null if never connected, or if migration 0026 hasn't run yet. */
export async function getYtConnection(supabase: Client) {
  const { data, error } = await supabase.from("yt_connections").select("*").eq("id", true).maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  return data;
}
