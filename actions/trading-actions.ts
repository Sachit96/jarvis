"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  marketAnalysisSchema,
  checklistItemSchema,
  DEFAULT_CHECKLIST_ITEMS,
} from "@/lib/validations/trading";
import { actionStateFromZodError, type ActionState } from "@/lib/validation";


function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ============================================================= Market analysis

export async function upsertMarketAnalysisAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = marketAnalysisSchema.safeParse({
    pair: formData.get("pair"),
    analysis_date: formData.get("analysis_date") || todayStr(),
    weekly_sentiment: formData.get("weekly_sentiment") || undefined,
    weekly_notes: formData.get("weekly_notes"),
    daily_sentiment: formData.get("daily_sentiment") || undefined,
    daily_notes: formData.get("daily_notes"),
    h4_sentiment: formData.get("h4_sentiment") || undefined,
    h4_notes: formData.get("h4_notes"),
  });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("market_analyses").upsert(
    {
      pair: parsed.data.pair.toUpperCase(),
      analysis_date: parsed.data.analysis_date,
      weekly_sentiment: parsed.data.weekly_sentiment ?? null,
      weekly_notes: parsed.data.weekly_notes || null,
      daily_sentiment: parsed.data.daily_sentiment ?? null,
      daily_notes: parsed.data.daily_notes || null,
      h4_sentiment: parsed.data.h4_sentiment ?? null,
      h4_notes: parsed.data.h4_notes || null,
    },
    { onConflict: "pair,analysis_date" },
  );
  if (error) return { error: error.message };
  revalidatePath("/finance/analysis");
  return {};
}

export async function deleteMarketAnalysisAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("market_analyses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/finance/analysis");
}

// ============================================================= Confluence checklist

export async function ensureDefaultChecklistAction() {
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("trade_checklist_items")
    .select("id", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);
  if (count && count > 0) return;

  const { error } = await supabase.from("trade_checklist_items").insert(
    DEFAULT_CHECKLIST_ITEMS.map((label, i) => ({
      label,
      sort_order: i,
    })),
  );
  if (error) throw new Error(error.message);
  // No revalidatePath — only ever called at the top of a Server Component's
  // render body, not from a client-triggered action; disallowed there in
  // production, and unnecessary since the page's own query right after this
  // already sees the fresh rows within the same request.
}

export async function createChecklistItemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = checklistItemSchema.safeParse({ label: formData.get("label") });
  if (!parsed.success) {
    return actionStateFromZodError(parsed.error);
  }
  const supabase = await createClient();
  const { count } = await supabase
    .from("trade_checklist_items")
    .select("id", { count: "exact", head: true });

  const { error } = await supabase.from("trade_checklist_items").insert({
    label: parsed.data.label,
    sort_order: count ?? 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/finance/trades");
  return {};
}

export async function deleteChecklistItemAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("trade_checklist_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/finance/trades");
}
