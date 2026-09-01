import { z } from "zod";
import { numeric, optionalNumeric, optionalTextInput } from "@/lib/validation";

export const ASSESSMENT_TYPES = ["assignment", "quiz", "midterm", "final", "presentation", "participation"] as const;
export const ASSESSMENT_STATUSES = ["not_started", "in_progress", "submitted", "graded"] as const;
export const SCHEDULE_BLOCK_TYPES = ["lecture", "tutorial", "lab", "office_hours"] as const;
export const MATERIAL_TYPES = ["slides", "notes", "reading", "practice_exam", "syllabus", "other"] as const;
export const DEADLINE_CATEGORIES = ["enrolment", "withdrawal", "tuition", "osap", "exam_period", "break", "other"] as const;

export const courseSchema = z.object({
  code: z.string().min(1, "Required").max(20),
  name: z.string().min(1, "Required").max(200),
  professor: optionalTextInput,
  professor_email: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().email("Invalid email").optional(),
  ),
  room: optionalTextInput,
  description: optionalTextInput,
  term: z.string().min(1, "Required").max(40),
  color: optionalTextInput,
  credit_weight: numeric(z.number().positive().max(20)),
  target_grade: optionalNumeric(z.number().min(0).max(100)),
});

export const scheduleBlockSchema = z.object({
  course_id: z.string().uuid(),
  type: z.enum(SCHEDULE_BLOCK_TYPES),
  day_of_week: numeric(z.number().int().min(0).max(6)),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Pick a time"),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Pick a time"),
  room: optionalTextInput,
});

export const assessmentSchema = z.object({
  course_id: z.string().uuid(),
  title: z.string().min(1, "Required").max(200),
  type: z.enum(ASSESSMENT_TYPES),
  due_at: optionalTextInput, // "YYYY-MM-DDTHH:mm" from <input type="datetime-local">, or empty
  weight_pct: numeric(z.number().min(0).max(100)),
  max_score: numeric(z.number().positive()).default(100),
  earned_score: optionalNumeric(z.number().min(0)),
  status: z.enum(ASSESSMENT_STATUSES).default("not_started"),
  estimated_hours: optionalNumeric(z.number().min(0).max(200)),
  difficulty: optionalNumeric(z.number().int().min(1).max(5)),
  notes: optionalTextInput,
});

export const assessmentRequirementSchema = z.object({
  assessment_id: z.string().uuid(),
  requirement: z.string().min(1, "Required").max(500),
});

export const studySessionSchema = z.object({
  course_id: z.string().uuid(),
  assessment_id: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().uuid().optional()),
  planned_start: z.string().min(1, "Pick a time"), // datetime-local
  planned_minutes: numeric(z.number().int().positive().max(1440)),
  notes: optionalTextInput,
});

export const materialSchema = z.object({
  course_id: z.string().uuid(),
  title: z.string().min(1, "Required").max(200),
  type: z.enum(MATERIAL_TYPES),
  body: z.string().min(1, "Paste or type something").max(200_000),
});

export const deadlineSchema = z.object({
  title: z.string().min(1, "Required").max(200),
  due_at: z.string().min(1, "Pick a date/time"), // datetime-local
  category: z.enum(DEADLINE_CATEGORIES),
  notes: optionalTextInput,
});

/** Flavor constants for course color-picking in the create/edit form — same idea as the app's existing category accent palette, distinct hues so courses are visually distinguishable across the calendar/schedule views. */
export const COURSE_COLORS = ["#8b5cf6", "#3b82f6", "#22c55e", "#f97316", "#ec4899", "#22d3ee", "#ef4444", "#eab308"] as const;
