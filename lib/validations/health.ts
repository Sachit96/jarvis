import { z } from "zod";

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  muscle_group: z.string().trim().max(60).optional().or(z.literal("")),
});
export type ExerciseInput = z.infer<typeof exerciseSchema>;

export const workoutSchema = z.object({
  session_label: z.string().trim().min(1, "Session name is required").max(60),
  started_at: z.string().min(1),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type WorkoutInput = z.infer<typeof workoutSchema>;

export const workoutSetSchema = z.object({
  workout_id: z.string().uuid(),
  exercise_id: z.string().uuid("Choose an exercise"),
  set_number: z.coerce.number().int().min(1).max(50),
  weight_kg: z.coerce.number().min(0).max(1000).optional(),
  reps: z.coerce.number().int().min(0).max(1000).optional(),
});
export type WorkoutSetInput = z.infer<typeof workoutSetSchema>;

export const nutritionTargetsSchema = z.object({
  target_calories: z.coerce.number().int().min(0).max(20000),
  target_protein_g: z.coerce.number().int().min(0).max(2000),
  target_carbs_g: z.coerce.number().int().min(0).max(2000),
  target_fat_g: z.coerce.number().int().min(0).max(2000),
  target_water_ml: z.coerce.number().int().min(0).max(20000),
});
export type NutritionTargetsInput = z.infer<typeof nutritionTargetsSchema>;

export const nutritionLogSchema = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  logged_at: z.string().min(1),
  description: z.string().trim().min(1, "Description is required").max(300),
  calories: z.coerce.number().int().min(0).max(20000),
  protein_g: z.coerce.number().min(0).max(2000),
  carbs_g: z.coerce.number().min(0).max(2000),
  fat_g: z.coerce.number().min(0).max(2000),
});
export type NutritionLogInput = z.infer<typeof nutritionLogSchema>;

export const waterLogSchema = z.object({
  amount_ml: z.coerce.number().int().min(1).max(5000),
});
export type WaterLogInput = z.infer<typeof waterLogSchema>;

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
