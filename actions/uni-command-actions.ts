"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callGemini, type GeminiFunctionDeclaration } from "@/lib/ai/providers/gemini-client";
import { getCourses, getAssessments } from "@/lib/db/queries/uni";
import { courseGrade } from "@/lib/uni/grades";
import { planTonightAction } from "@/actions/uni-plan-actions";

/**
 * Command bar UniOS extension (Work Order 3, last item). One Gemma
 * "high_volume" tool-calling call decides WHICH of the four declared
 * actions the user meant and extracts its arguments — it never executes
 * anything itself. Every argument the model returns (course code,
 * assessment title) is then matched against the user's REAL data here in
 * code; a confident exact/substring match executes, anything else comes
 * back as "ambiguous" so the command palette can fall back to its normal
 * search instead of guessing which course/assessment was meant.
 */
const TOOLS: GeminiFunctionDeclaration[] = [
  {
    name: "create_assessment",
    description: "Add a new assessment (assignment, quiz, exam, etc.) to a course.",
    parameters: {
      type: "OBJECT",
      properties: {
        course_code: { type: "STRING", description: "The course code mentioned, e.g. QMS" },
        title: { type: "STRING" },
        due_date: { type: "STRING", description: "YYYY-MM-DD if a date/day was mentioned, else omit" },
        weight_pct: { type: "NUMBER", description: "Percent weight if mentioned, else omit" },
      },
      required: ["course_code", "title"],
    },
  },
  {
    name: "complete_assessment",
    description: "Mark an assessment as submitted/done.",
    parameters: {
      type: "OBJECT",
      properties: { title: { type: "STRING", description: "The assessment title or a close match to it" } },
      required: ["title"],
    },
  },
  {
    name: "plan_tonight",
    description: "Produce tonight's study plan given available hours.",
    parameters: {
      type: "OBJECT",
      properties: { hours: { type: "NUMBER" } },
      required: ["hours"],
    },
  },
  {
    name: "grade_check",
    description: "Report the current grade for a course.",
    parameters: {
      type: "OBJECT",
      properties: { course_code: { type: "STRING" } },
      required: ["course_code"],
    },
  },
];

const SYSTEM_INSTRUCTION = `You route a natural-language command from a university student's command bar to exactly one of the tools you have. Only call a tool if the command clearly matches one of them. If it's ambiguous, ambiguous which course/assessment is meant, or doesn't match any tool, do NOT call a tool — just reply with the single word "unclear".`;

export interface CommandResult {
  matched: boolean;
  message: string;
}

function findCourse(courses: { id: string; code: string }[], codeGuess: string) {
  const needle = codeGuess.trim().toLowerCase();
  const exact = courses.find((c) => c.code.toLowerCase() === needle);
  if (exact) return exact;
  const partial = courses.filter((c) => c.code.toLowerCase().includes(needle) || needle.includes(c.code.toLowerCase()));
  return partial.length === 1 ? partial[0] : null;
}

function findAssessment(assessments: { id: string; title: string; course_id: string }[], titleGuess: string) {
  const needle = titleGuess.trim().toLowerCase();
  const exact = assessments.find((a) => a.title.toLowerCase() === needle);
  if (exact) return exact;
  const partial = assessments.filter((a) => a.title.toLowerCase().includes(needle) || needle.includes(a.title.toLowerCase()));
  return partial.length === 1 ? partial[0] : null;
}

export async function runUniCommandAction(command: string): Promise<CommandResult> {
  if (!process.env.GEMINI_API_KEY) return { matched: false, message: "GEMINI_API_KEY is not configured" };

  const supabase = await createClient();
  const courses = await getCourses(supabase).catch(() => []);
  if (courses.length === 0) return { matched: false, message: "No courses set up yet" };
  const assessments = await getAssessments(supabase, courses.map((c) => c.id)).catch(() => []);

  let call;
  try {
    const { functionCalls } = await callGemini({
      tier: "high_volume",
      systemInstruction: SYSTEM_INSTRUCTION,
      contents: [{ role: "user", parts: [{ text: command }] }],
      tools: TOOLS,
    });
    call = functionCalls[0];
  } catch (err) {
    return { matched: false, message: err instanceof Error ? err.message : "Command parsing failed" };
  }
  if (!call) return { matched: false, message: "Couldn't match that to a UniOS action — try search instead." };

  switch (call.name) {
    case "create_assessment": {
      const args = call.args as { course_code: string; title: string; due_date?: string; weight_pct?: number };
      const course = findCourse(courses, args.course_code);
      if (!course) return { matched: false, message: `Couldn't find a course matching "${args.course_code}" — not creating anything.` };
      const { error } = await supabase.from("uni_assessments").insert({
        course_id: course.id,
        title: args.title,
        type: "assignment",
        due_at: args.due_date ? `${args.due_date}T23:59:00` : null,
        weight_pct: args.weight_pct ?? 0,
      });
      if (error) return { matched: false, message: error.message };
      revalidatePath("/uni");
      revalidatePath(`/uni/courses/${course.id}`);
      return { matched: true, message: `Added "${args.title}" to ${course.code}${args.due_date ? ` (due ${args.due_date})` : ""}.` };
    }
    case "complete_assessment": {
      const args = call.args as { title: string };
      const assessment = findAssessment(assessments, args.title);
      if (!assessment) return { matched: false, message: `Couldn't find an assessment matching "${args.title}" — not changing anything.` };
      await supabase.from("uni_assessments").update({ status: "submitted" }).eq("id", assessment.id);
      revalidatePath("/uni");
      return { matched: true, message: `Marked "${assessment.title}" as submitted.` };
    }
    case "plan_tonight": {
      const args = call.args as { hours: number };
      const res = await planTonightAction(args.hours);
      if (!res.ok) return { matched: false, message: res.error ?? "Planning failed" };
      return { matched: true, message: res.phrasing ?? "Plan ready — see the Uni dashboard." };
    }
    case "grade_check": {
      const args = call.args as { course_code: string };
      const course = findCourse(courses, args.course_code);
      if (!course) return { matched: false, message: `Couldn't find a course matching "${args.course_code}".` };
      const grade = courseGrade(assessments.filter((a) => a.course_id === course.id));
      return { matched: true, message: grade != null ? `${course.code} is currently at ${grade.toFixed(1)}%.` : `${course.code} has nothing graded yet.` };
    }
    default:
      return { matched: false, message: "Couldn't match that to a UniOS action — try search instead." };
  }
}
