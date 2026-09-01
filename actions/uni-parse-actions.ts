"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSyllabus, parseAssignmentInstructions } from "@/lib/ai/providers/gemini-uni-parser";
import type { SyllabusParseResult, AssignmentBreakdownResult } from "@/lib/validations/uni-parse";
import { getAssessments } from "@/lib/db/queries/uni";

export interface ParseSyllabusResult {
  ok: boolean;
  error?: string;
  parsed?: SyllabusParseResult;
  /** Assessment titles (from this parse) that share a due_date with something already on the calendar — surfaced on the review screen, not auto-resolved. */
  dateConflicts?: { title: string; due_date: string; conflictsWith: string[] }[];
}

/** Parses only — never writes. The review screen is what actually creates rows, via confirmSyllabusAssessmentsAction below. */
export async function parseSyllabusAction(courseId: string, input: { text?: string; fileBase64?: string; fileMimeType?: string }): Promise<ParseSyllabusResult> {
  if (!process.env.GEMINI_API_KEY) return { ok: false, error: "GEMINI_API_KEY is not configured" };
  try {
    const parsed = await parseSyllabus(input);
    const supabase = await createClient();
    const existing = await getAssessments(supabase);
    const byDate = new Map<string, string[]>();
    for (const a of existing) {
      if (!a.due_at) continue;
      const key = a.due_at.slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(a.title);
    }
    const dateConflicts = parsed.assessments
      .filter((a) => a.due_date && byDate.has(a.due_date))
      .map((a) => ({ title: a.title, due_date: a.due_date!, conflictsWith: byDate.get(a.due_date!)! }));
    return { ok: true, parsed, dateConflicts };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Syllabus parse failed" };
  }
}

export interface ConfirmSyllabusInput {
  courseId: string;
  professor?: string;
  professor_email?: string;
  assessments: { title: string; type: string; due_date: string | null; weight_pct: number | null }[];
  scheduleBlocks: { type: string; day_of_week: number; start_time: string; end_time: string; room: string | null }[];
}

/** The only place a syllabus parse actually writes anything — called from the review screen after the user has looked at (and possibly edited) the extracted list. */
export async function confirmSyllabusAction(input: ConfirmSyllabusInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  if (input.professor || input.professor_email) {
    await supabase
      .from("uni_courses")
      .update({ professor: input.professor || undefined, professor_email: input.professor_email || undefined })
      .eq("id", input.courseId);
  }

  if (input.assessments.length > 0) {
    const { error } = await supabase.from("uni_assessments").insert(
      input.assessments.map((a) => ({
        course_id: input.courseId,
        title: a.title,
        type: a.type,
        due_at: a.due_date ? `${a.due_date}T23:59:00` : null,
        weight_pct: a.weight_pct ?? 0,
        source: "syllabus" as const,
      })),
    );
    if (error) return { ok: false, error: error.message };
  }

  if (input.scheduleBlocks.length > 0) {
    const { error } = await supabase.from("uni_schedule_blocks").insert(
      input.scheduleBlocks.map((b) => ({
        course_id: input.courseId,
        type: b.type,
        day_of_week: b.day_of_week,
        start_time: b.start_time,
        end_time: b.end_time,
        room: b.room,
      })),
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/uni/courses/${input.courseId}`);
  revalidatePath("/uni");
  revalidatePath("/uni/assessments");
  revalidatePath("/uni/calendar");
  return { ok: true };
}

export interface ParseAssignmentResult {
  ok: boolean;
  error?: string;
  parsed?: AssignmentBreakdownResult;
}

export async function parseAssignmentAction(
  assessmentId: string,
  instructions: string,
  availableHours: number,
): Promise<ParseAssignmentResult> {
  if (!process.env.GEMINI_API_KEY) return { ok: false, error: "GEMINI_API_KEY is not configured" };
  try {
    const supabase = await createClient();
    const { data: assessment, error } = await supabase.from("uni_assessments").select("*").eq("id", assessmentId).maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!assessment) return { ok: false, error: "Assessment not found" };

    const daysUntilDue = assessment.due_at ? Math.round((new Date(assessment.due_at).getTime() - Date.now()) / 86_400_000) : null;
    const parsed = await parseAssignmentInstructions(instructions, {
      assessmentTitle: assessment.title,
      availableHours,
      daysUntilDue,
    });
    return { ok: true, parsed };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Assignment breakdown failed" };
  }
}

export interface ConfirmAssignmentBreakdownInput {
  assessmentId: string;
  courseId: string;
  requirements: string[];
  estimatedHours: number | null;
  studyPlan: { dayOffset: number; minutes: number; focus: string }[];
}

export async function confirmAssignmentBreakdownAction(input: ConfirmAssignmentBreakdownInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  if (input.requirements.length > 0) {
    const { error } = await supabase.from("uni_assessment_requirements").insert(
      input.requirements.map((requirement, i) => ({ assessment_id: input.assessmentId, requirement, sort_order: i })),
    );
    if (error) return { ok: false, error: error.message };
  }

  if (input.estimatedHours != null) {
    await supabase.from("uni_assessments").update({ estimated_hours: input.estimatedHours }).eq("id", input.assessmentId);
  }

  if (input.studyPlan.length > 0) {
    const now = new Date();
    const { error } = await supabase.from("uni_study_sessions").insert(
      input.studyPlan.map((s) => {
        const start = new Date(now);
        start.setDate(start.getDate() + s.dayOffset);
        start.setHours(19, 0, 0, 0); // 7pm default — a reasonable "after classes" slot, editable afterward
        return {
          course_id: input.courseId,
          assessment_id: input.assessmentId,
          planned_start: start.toISOString(),
          planned_minutes: s.minutes,
          notes: s.focus,
        };
      }),
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/uni/courses/${input.courseId}`);
  return { ok: true };
}
