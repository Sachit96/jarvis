import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EXPORT_TABLES = [
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
  "ghl_sync_logs",
  // ghl_connections is intentionally excluded — it holds the raw GHL private
  // integration token, which shouldn't be included in a downloadable backup.
] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const results = await Promise.all(
    EXPORT_TABLES.map(async (table) => {
      const { data, error } = await supabase.from(table).select("*");
      if (error) throw new Error(`${table}: ${error.message}`);
      return [table, data] as const;
    }),
  );

  const payload = {
    exportedAt: new Date().toISOString(),
    userEmail: user.email,
    data: Object.fromEntries(results),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="jarvis-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
