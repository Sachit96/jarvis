import { z } from "zod";
import { numeric, optionalNumeric, optionalTextInput, dateInput } from "@/lib/validation";

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  muscle_group: z.string().trim().max(60).optional().or(z.literal("")),
});
export type ExerciseInput = z.infer<typeof exerciseSchema>;

export const workoutSchema = z.object({
  session_label: z.string().trim().min(1, "Session name is required").max(60),
  // datetime-local input ("YYYY-MM-DDTHH:mm"), not a plain date — dateInput's regex doesn't apply here.
  started_at: z.string().min(1, "Pick a start time"),
  notes: optionalTextInput,
});
export type WorkoutInput = z.infer<typeof workoutSchema>;

export const workoutSetSchema = z.object({
  workout_id: z.string().uuid(),
  exercise_id: z.string().uuid("Choose an exercise"),
  set_number: numeric(z.number().int().min(1).max(50)),
  // The form/UI works in lbs (weight_lbs) — converted to weight_kg for
  // storage in actions/health-actions.ts via lib/units.ts, since the schema
  // column stays kg (matches every other weight/volume column in the DB).
  weight_lbs: optionalNumeric(z.number().min(0, "Enter a weight of 0 or more").max(2200, "That weight looks too high")),
  reps: optionalNumeric(z.number().int().min(0, "Reps can't be negative").max(1000)),
});
export type WorkoutSetInput = z.infer<typeof workoutSetSchema>;

export const nutritionTargetsSchema = z.object({
  target_calories: numeric(z.number().int().min(0).max(20000, "Enter a realistic daily calorie target")),
  target_protein_g: numeric(z.number().int().min(0).max(2000)),
  target_carbs_g: numeric(z.number().int().min(0).max(2000)),
  target_fat_g: numeric(z.number().int().min(0).max(2000)),
  target_water_ml: numeric(z.number().int().min(0).max(20000)),
});
export type NutritionTargetsInput = z.infer<typeof nutritionTargetsSchema>;

export const nutritionLogSchema = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  logged_at: dateInput,
  description: z.string().trim().min(1, "Description is required").max(300),
  calories: numeric(z.number().int().min(0, "Calories can't be negative").max(20000)),
  protein_g: numeric(z.number().min(0).max(2000)),
  carbs_g: numeric(z.number().min(0).max(2000)),
  fat_g: numeric(z.number().min(0).max(2000)),
});
export type NutritionLogInput = z.infer<typeof nutritionLogSchema>;

export const waterLogSchema = z.object({
  amount_ml: numeric(z.number().int().min(1, "Enter an amount above 0").max(5000, "That's more than 5L — double check")),
});
export type WaterLogInput = z.infer<typeof waterLogSchema>;

export const bodyMetricSchema = z.object({
  logged_at: dateInput,
  // Form/UI works in lbs — converted to weight_kg for storage (see note on workoutSetSchema above).
  weight_lbs: numeric(z.number().positive("Enter a weight above 0").max(2200, "That weight looks too high")),
  body_fat_pct: optionalNumeric(z.number().min(1, "Body fat must be between 1 and 70").max(70, "Body fat must be between 1 and 70")),
  notes: optionalTextInput,
});
export type BodyMetricInput = z.infer<typeof bodyMetricSchema>;

export const sleepLogSchema = z.object({
  log_date: dateInput,
  hours_slept: numeric(z.number().min(0, "Hours can't be negative").max(24, "A day only has 24 hours")),
  quality: optionalNumeric(z.number().int().min(1, "Quality is 1–5").max(5, "Quality is 1–5")),
  notes: optionalTextInput,
});
export type SleepLogInput = z.infer<typeof sleepLogSchema>;

export const mentorMessageSchema = z.object({
  content: z.string().trim().min(1, "Say something first").max(4000),
});
export type MentorMessageInput = z.infer<typeof mentorMessageSchema>;

export const DEFAULT_EXERCISES: { name: string; muscle_group: string }[] = [
  { name: "Bench Press", muscle_group: "Chest" },
  { name: "Squat", muscle_group: "Legs" },
  { name: "Deadlift", muscle_group: "Back" },
  { name: "Overhead Press", muscle_group: "Shoulders" },
  { name: "Pull-up", muscle_group: "Back" },
  { name: "Barbell Row", muscle_group: "Back" },
  { name: "Running", muscle_group: "Cardio" },
];
