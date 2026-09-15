import { z } from "zod";
import { ASSESSMENT_TYPES, SCHEDULE_BLOCK_TYPES } from "@/lib/validations/uni";

// ==================================================== Syllabus parsing

export const syllabusAssessmentSchema = z.object({
  title: z.string(),
  type: z.enum(ASSESSMENT_TYPES),
  due_date: z.string().nullable(), // "YYYY-MM-DD" or null if the syllabus didn't state one
  weight_pct: z.number().min(0).max(100).nullable(),
});

export const syllabusScheduleBlockSchema = z.object({
  type: z.enum(SCHEDULE_BLOCK_TYPES),
  day_of_week: z.number().int().min(0).max(6).nullable(),
  start_time: z.string().nullable(), // "HH:mm"
  end_time: z.string().nullable(),
  room: z.string().nullable(),
});

export const syllabusParseResultSchema = z.object({
  professor: z.string().nullable(),
  professor_email: z.string().nullable(),
  assessments: z.array(syllabusAssessmentSchema),
  scheduleBlocks: z.array(syllabusScheduleBlockSchema),
  requiredReadings: z.array(z.string()),
  keyPolicies: z.array(z.string()),
  /** Things the model saw but couldn't confidently extract into a structured field — reported to the user rather than silently dropped, per the review-before-write requirement. */
  unparsed: z.array(z.string()),
});
export type SyllabusParseResult = z.infer<typeof syllabusParseResultSchema>;

export const SYLLABUS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    professor: { type: "STRING", nullable: true },
    professor_email: { type: "STRING", nullable: true },
    assessments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          type: { type: "STRING", enum: ASSESSMENT_TYPES as unknown as string[] },
          due_date: { type: "STRING", nullable: true, description: "YYYY-MM-DD, or omit/null if not stated" },
          weight_pct: { type: "NUMBER", nullable: true },
        },
        required: ["title", "type"],
      },
    },
    scheduleBlocks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: SCHEDULE_BLOCK_TYPES as unknown as string[] },
          day_of_week: { type: "INTEGER", nullable: true, description: "0=Sunday..6=Saturday" },
          start_time: { type: "STRING", nullable: true, description: "HH:mm 24-hour" },
          end_time: { type: "STRING", nullable: true },
          room: { type: "STRING", nullable: true },
        },
        required: ["type"],
      },
    },
    requiredReadings: { type: "ARRAY", items: { type: "STRING" } },
    keyPolicies: { type: "ARRAY", items: { type: "STRING" } },
    unparsed: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["assessments", "scheduleBlocks", "requiredReadings", "keyPolicies", "unparsed"],
};

// ================================================= Assignment breakdown

export const assignmentBreakdownResultSchema = z.object({
  requirements: z.array(z.string()).max(30),
  estimatedHours: z.number().min(0).max(200).nullable(),
  studyPlan: z.array(
    z.object({
      dayOffset: z.number().int().min(0).max(60), // days from today
      minutes: z.number().int().min(15).max(480),
      focus: z.string(),
    }),
  ),
  unparsed: z.array(z.string()),
});
export type AssignmentBreakdownResult = z.infer<typeof assignmentBreakdownResultSchema>;

export const ASSIGNMENT_BREAKDOWN_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    requirements: { type: "ARRAY", items: { type: "STRING" } },
    estimatedHours: { type: "NUMBER", nullable: true },
    studyPlan: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          dayOffset: { type: "INTEGER", description: "Days from today this session should happen, 0 = today" },
          minutes: { type: "INTEGER" },
          focus: { type: "STRING" },
        },
        required: ["dayOffset", "minutes", "focus"],
      },
    },
    unparsed: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["requirements", "estimatedHours", "studyPlan", "unparsed"],
};
