import { z } from "zod";
import { optionalNumeric, optionalTextInput, optionalDateInput, dateInput } from "@/lib/validation";

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optionalTextInput,
  priority: z.enum(["high", "medium", "low"]),
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
  due_date: optionalDateInput,
});
export type TaskInput = z.infer<typeof taskSchema>;

export const goalSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optionalTextInput,
  timeframe: z.enum(["daily", "weekly", "monthly"]),
  category: optionalTextInput,
  target_date: optionalDateInput,
  progress_percent: optionalNumeric(z.number().int().min(0).max(100)).default(0),
});
export type GoalInput = z.infer<typeof goalSchema>;

export const habitSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  metric_type: z.enum([
    "sleep",
    "focus",
    "training",
    "screen_time",
    "consistency",
    "no_g",
    "custom",
  ]),
  kind: z.enum(["boolean", "count"]),
  target_count: optionalNumeric(z.number().int().min(1, "Target must be at least 1").max(1000)),
});
export type HabitInput = z.infer<typeof habitSchema>;

export const journalEntrySchema = z.object({
  title: optionalTextInput,
  body: z.string().trim().min(1, "Write something first").max(20000),
  mood: optionalNumeric(z.number().int().min(1, "Mood is 1–5").max(5, "Mood is 1–5")),
  entry_type: z.enum(["reflection", "freeform", "gratitude"]),
  entry_date: dateInput,
});
export type JournalEntryInput = z.infer<typeof journalEntrySchema>;

// prayerSchema removed (Session 2, Phase 4 cleanup) — "Pray to God" has
// been a Daily Routine checklist item since migration 0011, and the
// standalone prayers/prayer_logs tables have had no UI or actions since.
// The tables themselves are untouched — dropping them is a real schema
// change, deliberately NOT bundled into this migration list; see
// supabase/migrations/0029_drop_prayers.sql and the morning report.
