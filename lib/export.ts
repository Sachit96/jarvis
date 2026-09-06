import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export const EXPORT_TABLES = [
  "tasks",
  "goals",
  "habits",
  "habit_logs",
  "journal_entries",
  "prayers",
  "prayer_logs",
  "accounts",
  "transactions",
  "budgets",
  "trades",
  "exercises",
  "workouts",
  "workout_sets",
  "nutrition_targets",
  "nutrition_logs",
  "water_logs",
  "mentor_messages",
  "market_analyses",
  "trade_checklist_items",
  "pipeline_stages",
  "contacts",
  "deals",
  "activities",
  "deal_tasks",
  "contracts",
  "client_onboarding_tasks",
  "daily_recommendations",
  "weekly_reviews",
] as const;

/** Shared between the bearer-protected GET route (external/scripted access) and exportJsonBackupAction (the Settings page's download button) — one place building the actual payload, not two slightly-different copies. */
export async function buildExportPayload(supabase: Client) {
  const results = await Promise.all(
    EXPORT_TABLES.map(async (table) => {
      const { data, error } = await supabase.from(table).select("*");
      if (error) throw new Error(`${table}: ${error.message}`);
      return [table, data] as const;
    }),
  );

  return {
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(results),
  };
}
