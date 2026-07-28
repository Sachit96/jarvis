"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { taskSchema, goalSchema, habitSchema, journalEntrySchema } from "@/lib/validations/life";

export interface ActionState {
  error?: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function parseTags(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ============================================================= Tasks

export async function createTaskAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority") || "medium",
    tags: parseTags(formData.get("tags")),
    due_date: formData.get("due_date"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    priority: parsed.data.priority,
    tags: parsed.data.tags,
    due_date: parsed.data.due_date || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/life/tasks");
  return {};
}

export async function deleteTaskAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/life/tasks");
}

export async function toggleTaskStatusAction(id: string, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      status: done ? "done" : "todo",
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/life/tasks");
}

// ============================================================= Goals

export async function createGoalAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = goalSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    timeframe: formData.get("timeframe") || "daily",
    category: formData.get("category"),
    target_date: formData.get("target_date"),
    progress_percent: formData.get("progress_percent") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    timeframe: parsed.data.timeframe,
    category: parsed.data.category || null,
    target_date: parsed.data.target_date || null,
    progress_percent: parsed.data.progress_percent,
    status: parsed.data.progress_percent >= 100 ? "achieved" : "active",
  });
  if (error) return { error: error.message };
  revalidatePath("/life/goals");
  return {};
}

export async function deleteGoalAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/life/goals");
}

export async function updateGoalProgressAction(id: string, progressPercent: number) {
  const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)));
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({
      progress_percent: clamped,
      status: clamped >= 100 ? "achieved" : "active",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/life/goals");
}

// ============================================================= Habits

export async function createHabitAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = habitSchema.safeParse({
    name: formData.get("name"),
    metric_type: formData.get("metric_type") || "custom",
    kind: formData.get("kind") || "boolean",
    target_count: formData.get("target_count") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { count } = await supabase.from("habits").select("id", { count: "exact", head: true });

  const { error } = await supabase.from("habits").insert({
    user_id: user.id,
    name: parsed.data.name,
    metric_type: parsed.data.metric_type,
    kind: parsed.data.kind,
    target_count: parsed.data.target_count ?? null,
    sort_order: count ?? 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/life/habits");
  return {};
}

export async function deleteHabitAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("habits").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/life/habits");
}

export async function toggleHabitTodayAction(habitId: string, completed: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("habit_logs")
    .upsert(
      {
        user_id: user.id,
        habit_id: habitId,
        log_date: todayStr(),
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: "habit_id,log_date" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/life/habits");
  revalidatePath("/dashboard");
}

export async function toggleHabitPinnedAction(id: string, pinned: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("habits").update({ pinned }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/life/habits");
}

/** Swaps this habit's sort_order with its neighbor in the current display order. */
export async function moveHabitAction(id: string, direction: "up" | "down") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: habits, error: fetchError } = await supabase
    .from("habits")
    .select("id, sort_order, pinned")
    .eq("is_active", true)
    .order("pinned", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (fetchError) throw new Error(fetchError.message);

  const index = habits.findIndex((h) => h.id === id);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || neighborIndex < 0 || neighborIndex >= habits.length) return;

  const current = habits[index];
  const neighbor = habits[neighborIndex];
  // Only swap within the same pinned group — pinned items shouldn't drift into the unpinned list via reorder.
  if (current.pinned !== neighbor.pinned) return;

  const { error: err1 } = await supabase.from("habits").update({ sort_order: neighbor.sort_order }).eq("id", current.id);
  const { error: err2 } = await supabase.from("habits").update({ sort_order: current.sort_order }).eq("id", neighbor.id);
  if (err1 || err2) throw new Error(err1?.message ?? err2?.message);
  revalidatePath("/life/habits");
}

/** Idempotent — inserts starter routine items (including "No G") only if the user has none yet. */
export async function ensureDefaultHabitsAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { count, error: countError } = await supabase
    .from("habits")
    .select("id", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);
  if (count && count > 0) return;

  const defaults = [
    { name: "No G", metric_type: "no_g" as const, kind: "boolean" as const, pinned: true },
    { name: "Pray to God", metric_type: "custom" as const, kind: "boolean" as const, pinned: true },
    { name: "Run", metric_type: "custom" as const, kind: "boolean" as const, pinned: false },
    { name: "Read for 30 minutes", metric_type: "custom" as const, kind: "boolean" as const, pinned: false },
  ];
  const { error } = await supabase
    .from("habits")
    .insert(defaults.map((d, i) => ({ ...d, user_id: user.id, sort_order: i })));
  if (error) throw new Error(error.message);
  // No revalidatePath here — this only ever runs at the top of a Server
  // Component's render body (never from a client-triggered form submit), and
  // Next.js disallows calling revalidatePath during render outside a real
  // Server Action invocation. The page's own query right after this call
  // already sees the freshly-inserted rows within the same request, so there
  // is nothing stale to revalidate anyway.
}

// ============================================================= Journal

export async function createJournalEntryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = journalEntrySchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    mood: formData.get("mood") || undefined,
    entry_type: formData.get("entry_type") || "reflection",
    entry_date: formData.get("entry_date") || todayStr(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("journal_entries").insert({
    user_id: user.id,
    title: parsed.data.title || null,
    body: parsed.data.body,
    mood: parsed.data.mood ?? null,
    entry_type: parsed.data.entry_type,
    entry_date: parsed.data.entry_date,
  });
  if (error) return { error: error.message };
  revalidatePath("/life/journal");
  return {};
}

export async function deleteJournalEntryAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/life/journal");
}

// Prayer used to be its own module (see git history for
// ensureDefaultPrayersAction/createPrayerAction/deletePrayerAction/
// togglePrayerTodayAction) — removed once "Pray to God" became a Daily
// Routine item instead. The prayers/prayer_logs tables and their historical
// data are untouched; only the now-redundant standalone UI/actions are gone.
