import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isMissingRelation } from "@/lib/db/missing-relation";

type Client = SupabaseClient<Database>;

export const EXPORT_TABLES = [
  "tasks",
  "goals",
  "habits",
  "habit_logs",
  "journal_entries",
  // Dropped by the opt-in migration 0029. Kept here because 0029 tells you to
  // take this backup BEFORE running it; buildExportPayload skips them once
  // they are gone.
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

/**
 * Shared between the bearer-protected GET route (external/scripted access) and
 * exportJsonBackupAction (the Settings page's download button) — one place
 * building the actual payload, not two slightly-different copies.
 *
 * A table listed here may legitimately not exist: migration 0029 (drop
 * prayers) is deliberately opt-in, so this list has to span both sides of it.
 * A missing table is therefore skipped and named in `skipped`, not thrown —
 * the previous behaviour failed the whole backup on the first absent table,
 * which took out the one escape hatch 0029 tells you to use before running it.
 * Any other error still throws: a permissions or connection failure must not
 * quietly produce a backup with holes in it.
 */
export async function buildExportPayload(supabase: Client) {
  const results = await Promise.all(
    EXPORT_TABLES.map(async (table) => {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        if (isMissingRelation(error)) return [table, null] as const;
        throw new Error(`${table}: ${error.message}`);
      }
      return [table, data] as const;
    }),
  );

  const present = results.filter(([, rows]) => rows !== null);
  const skipped = results.filter(([, rows]) => rows === null).map(([table]) => table);

  return {
    exportedAt: new Date().toISOString(),
    // Named explicitly so a restore can tell "this table was empty" from
    // "this table no longer exists", which are very different facts.
    skipped,
    data: Object.fromEntries(present),
  };
}
