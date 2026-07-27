import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  priority: z.enum(["high", "medium", "low"]),
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
  due_date: z.string().optional().or(z.literal("")),
});
export type TaskInput = z.infer<typeof taskSchema>;

export const goalSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  timeframe: z.enum(["daily", "weekly", "monthly"]),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  target_date: z.string().optional().or(z.literal("")),
  progress_percent: z.coerce.number().int().min(0).max(100),
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
  target_count: z.coerce.number().int().min(1).max(1000).optional(),
});
export type HabitInput = z.infer<typeof habitSchema>;

export const journalEntrySchema = z.object({
  title: z.string().trim().max(200).optional().or(z.literal("")),
  body: z.string().trim().min(1, "Write something first").max(20000),
  mood: z.coerce.number().int().min(1).max(5).optional(),
  entry_type: z.enum(["reflection", "freeform", "gratitude"]),
  entry_date: z.string().min(1),
});
export type JournalEntryInput = z.infer<typeof journalEntrySchema>;

export const prayerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
});
export type PrayerInput = z.infer<typeof prayerSchema>;
