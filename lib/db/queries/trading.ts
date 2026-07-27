import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export async function getMarketAnalyses(supabase: Client) {
  const { data, error } = await supabase
    .from("market_analyses")
    .select("*")
    .order("analysis_date", { ascending: false })
    .order("pair", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getChecklistItems(supabase: Client) {
  const { data, error } = await supabase
    .from("trade_checklist_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}
