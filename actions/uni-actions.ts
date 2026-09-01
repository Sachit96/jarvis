"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  courseSchema,
  scheduleBlockSchema,
  assessmentSchema,
  assessmentRequirementSchema,
  studySessionSchema,
  materialSchema,
  deadlineSchema,
} from "@/lib/validations/uni";
import { actionStateFromZodError, type ActionState } from "@/lib/validation";

function revalidateUni() {
  revalidatePath("/uni");
  revalidatePath("/uni/courses");
  revalidatePath("/uni/calendar");
  revalidatePath("/uni/assessments");
  revalidatePath("/uni/deadlines");
}

// ============================================================= Courses

export async function createCourseAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = courseSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    professor: formData.get("professor"),
    professor_email: formData.get("professor_email"),
    room: formData.get("room"),
    description: formData.get("description"),
    term: formData.get("term"),
    color: formData.get("color"),
    credit_weight: formData.get("credit_weight") || "3",
    target_grade: formData.get("target_grade"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("uni_courses").insert({
    code: parsed.data.code,
    name: parsed.data.name,
    professor: parsed.data.professor ?? null,
    professor_email: parsed.data.professor_email ?? null,
    room: parsed.data.room ?? null,
    description: parsed.data.description ?? null,
    term: parsed.data.term,
    color: parsed.data.color ?? null,
    credit_weight: parsed.data.credit_weight,
    target_grade: parsed.data.target_grade ?? null,
  });
  if (error) return { error: error.message };
  revalidateUni();
  return {};
}

export async function updateCourseAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing course id" };
  const parsed = courseSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    professor: formData.get("professor"),
    professor_email: formData.get("professor_email"),
    room: formData.get("room"),
    description: formData.get("description"),
    term: formData.get("term"),
    color: formData.get("color"),
    credit_weight: formData.get("credit_weight") || "3",
    target_grade: formData.get("target_grade"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("uni_courses")
    .update({
      code: parsed.data.code,
      name: parsed.data.name,
      professor: parsed.data.professor ?? null,
      professor_email: parsed.data.professor_email ?? null,
      room: parsed.data.room ?? null,
      description: parsed.data.description ?? null,
      term: parsed.data.term,
      color: parsed.data.color ?? null,
      credit_weight: parsed.data.credit_weight,
      target_grade: parsed.data.target_grade ?? null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateUni();
  revalidatePath(`/uni/courses/${id}`);
  return {};
}

export async function archiveCourseAction(id: string, archived: boolean): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_courses").update({ archived }).eq("id", id);
  revalidateUni();
}

export async function deleteCourseAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_courses").delete().eq("id", id);
  revalidateUni();
}

// ===================================================== Schedule blocks

export async function createScheduleBlockAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = scheduleBlockSchema.safeParse({
    course_id: formData.get("course_id"),
    type: formData.get("type"),
    day_of_week: formData.get("day_of_week"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    room: formData.get("room"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("uni_schedule_blocks").insert(parsed.data);
  if (error) return { error: error.message };
  revalidateUni();
  revalidatePath(`/uni/courses/${parsed.data.course_id}`);
  return {};
}

export async function deleteScheduleBlockAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_schedule_blocks").delete().eq("id", id);
  revalidateUni();
}

// ========================================================= Assessments

export async function createAssessmentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = assessmentSchema.safeParse({
    course_id: formData.get("course_id"),
    title: formData.get("title"),
    type: formData.get("type"),
    due_at: formData.get("due_at"),
    weight_pct: formData.get("weight_pct"),
    max_score: formData.get("max_score") || "100",
    earned_score: formData.get("earned_score"),
    status: formData.get("status") || "not_started",
    estimated_hours: formData.get("estimated_hours"),
    difficulty: formData.get("difficulty"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("uni_assessments").insert({
    ...parsed.data,
    due_at: parsed.data.due_at ?? null,
    earned_score: parsed.data.earned_score ?? null,
    estimated_hours: parsed.data.estimated_hours ?? null,
    difficulty: parsed.data.difficulty ?? null,
    notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message };
  revalidateUni();
  revalidatePath(`/uni/courses/${parsed.data.course_id}`);
  return {};
}

export async function updateAssessmentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing assessment id" };
  const parsed = assessmentSchema.safeParse({
    course_id: formData.get("course_id"),
    title: formData.get("title"),
    type: formData.get("type"),
    due_at: formData.get("due_at"),
    weight_pct: formData.get("weight_pct"),
    max_score: formData.get("max_score") || "100",
    earned_score: formData.get("earned_score"),
    status: formData.get("status") || "not_started",
    estimated_hours: formData.get("estimated_hours"),
    difficulty: formData.get("difficulty"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("uni_assessments")
    .update({
      ...parsed.data,
      due_at: parsed.data.due_at ?? null,
      earned_score: parsed.data.earned_score ?? null,
      estimated_hours: parsed.data.estimated_hours ?? null,
      difficulty: parsed.data.difficulty ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateUni();
  revalidatePath(`/uni/courses/${parsed.data.course_id}`);
  return {};
}

/** Quick-update just the grade + status from the course dashboard's inline grade entry — the common case doesn't need the full edit form. */
export async function recordGradeAction(id: string, earnedScore: number, courseId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_assessments").update({ earned_score: earnedScore, status: "graded" }).eq("id", id);
  revalidateUni();
  revalidatePath(`/uni/courses/${courseId}`);
}

export async function setAssessmentStatusAction(id: string, status: string, courseId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_assessments").update({ status }).eq("id", id);
  revalidateUni();
  revalidatePath(`/uni/courses/${courseId}`);
}

export async function deleteAssessmentAction(id: string, courseId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_assessments").delete().eq("id", id);
  revalidateUni();
  revalidatePath(`/uni/courses/${courseId}`);
}

// ============================================ Assessment requirements

export async function createAssessmentRequirementAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = assessmentRequirementSchema.safeParse({
    assessment_id: formData.get("assessment_id"),
    requirement: formData.get("requirement"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);
  const supabase = await createClient();
  const { count } = await supabase
    .from("uni_assessment_requirements")
    .select("*", { count: "exact", head: true })
    .eq("assessment_id", parsed.data.assessment_id);
  const { error } = await supabase.from("uni_assessment_requirements").insert({ ...parsed.data, sort_order: count ?? 0 });
  if (error) return { error: error.message };
  revalidateUni();
  return {};
}

export async function toggleAssessmentRequirementAction(id: string, completed: boolean): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_assessment_requirements").update({ completed }).eq("id", id);
  revalidateUni();
}

export async function deleteAssessmentRequirementAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_assessment_requirements").delete().eq("id", id);
  revalidateUni();
}

// =============================================== Study sessions

export async function createStudySessionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = studySessionSchema.safeParse({
    course_id: formData.get("course_id"),
    assessment_id: formData.get("assessment_id"),
    planned_start: formData.get("planned_start"),
    planned_minutes: formData.get("planned_minutes"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("uni_study_sessions").insert({
    ...parsed.data,
    assessment_id: parsed.data.assessment_id ?? null,
    notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message };
  revalidateUni();
  return {};
}

export async function toggleStudySessionCompletedAction(id: string, completed: boolean, actualMinutes?: number): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("uni_study_sessions")
    .update({ completed, actual_minutes: actualMinutes ?? null })
    .eq("id", id);
  revalidateUni();
}

export async function deleteStudySessionAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_study_sessions").delete().eq("id", id);
  revalidateUni();
}

// ========================================================= Materials

export async function createMaterialAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = materialSchema.safeParse({
    course_id: formData.get("course_id"),
    title: formData.get("title"),
    type: formData.get("type"),
    body: formData.get("body"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("uni_materials").insert(parsed.data);
  if (error) return { error: error.message };
  revalidatePath(`/uni/courses/${parsed.data.course_id}`);
  return {};
}

export async function deleteMaterialAction(id: string, courseId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_materials").delete().eq("id", id);
  revalidatePath(`/uni/courses/${courseId}`);
}

// ========================================================= Deadlines

export async function createDeadlineAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = deadlineSchema.safeParse({
    title: formData.get("title"),
    due_at: formData.get("due_at"),
    category: formData.get("category"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("uni_deadlines").insert({ ...parsed.data, notes: parsed.data.notes ?? null });
  if (error) return { error: error.message };
  revalidateUni();
  return {};
}

export async function deleteDeadlineAction(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_deadlines").delete().eq("id", id);
  revalidateUni();
}
