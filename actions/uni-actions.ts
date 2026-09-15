"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  courseSchema,
  scheduleBlockSchema,
  assessmentSchema,
  assessmentGroupSchema,
  assessmentRequirementSchema,
  studySessionSchema,
  materialSchema,
  deadlineSchema,
  attendanceSchema,
} from "@/lib/validations/uni";
import { actionStateFromZodError, type ActionState } from "@/lib/validation";
import { isMissingRelation } from "@/lib/db/missing-relation";
import { getAssessmentRequirements } from "@/lib/db/queries/uni";

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
    term_start: formData.get("term_start"),
    term_end: formData.get("term_end"),
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
    // Left out of the payload entirely when unset (undefined, not null) —
    // until migration 0032 is applied, term_start/term_end don't exist as
    // real columns, and a key with any value (including null) would 400.
    // See courseSchema's comment.
    term_start: parsed.data.term_start ?? undefined,
    term_end: parsed.data.term_end ?? undefined,
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
    term_start: formData.get("term_start"),
    term_end: formData.get("term_end"),
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
      term_start: parsed.data.term_start ?? undefined,
      term_end: parsed.data.term_end ?? undefined,
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

// =================================================== Assessment groups

/**
 * Best-N-of-M buckets. lib/uni/grades.ts has resolved these from the day it
 * was written — courseGrade, neededOnRemaining, bestCase and worstCase all
 * take a `groups` argument — but no action ever wrote one, so a syllabus
 * that says "quizzes, lowest two dropped" could not be modelled and every
 * projection for that course was wrong in the pessimistic direction.
 */
export async function createAssessmentGroupAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = assessmentGroupSchema.safeParse({
    course_id: formData.get("course_id"),
    label: formData.get("label"),
    drop_lowest_count: formData.get("drop_lowest_count") || "0",
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("uni_assessment_groups").insert(parsed.data);
  if (error) return { error: error.message };
  revalidateUni();
  revalidatePath(`/uni/courses/${parsed.data.course_id}`);
  return {};
}

export async function updateAssessmentGroupAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing group id" };
  const parsed = assessmentGroupSchema.safeParse({
    course_id: formData.get("course_id"),
    label: formData.get("label"),
    drop_lowest_count: formData.get("drop_lowest_count") || "0",
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("uni_assessment_groups")
    .update({ label: parsed.data.label, drop_lowest_count: parsed.data.drop_lowest_count })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateUni();
  revalidatePath(`/uni/courses/${parsed.data.course_id}`);
  return {};
}

/**
 * Deleting a group must not delete its assessments. The FK is ON DELETE SET
 * NULL, so members simply become ungrouped and keep their own weights —
 * which is the same thing as a group with drop_lowest_count 0.
 */
export async function deleteAssessmentGroupAction(id: string, courseId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("uni_assessment_groups").delete().eq("id", id);
  revalidateUni();
  revalidatePath(`/uni/courses/${courseId}`);
}

// ========================================================= Assessments

export async function createAssessmentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = assessmentSchema.safeParse({
    course_id: formData.get("course_id"),
    group_id: formData.get("group_id"),
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
    group_id: parsed.data.group_id ?? null,
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
    group_id: formData.get("group_id"),
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
      group_id: parsed.data.group_id ?? null,
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

/**
 * Read a single assessment's requirement checklist.
 *
 * A server action wrapping a query, matching getFlashcardsForMaterialAction:
 * requirements are fetched only when a checklist is opened, so the
 * assessments list does not pay for a per-row query it usually would not
 * show.
 */
export async function getAssessmentRequirementsAction(assessmentId: string) {
  const supabase = await createClient();
  return getAssessmentRequirements(supabase, assessmentId);
}

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
    group_id: formData.get("group_id"),
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

// ============================================================= Attendance

/**
 * Records attendance for one class occurrence.
 *
 * Upsert, not insert: marking the same class twice is a CORRECTION, not a
 * second data point, and the (course_id, class_date, schedule_block_id)
 * unique constraint in migration 0038 is what makes that safe. Without this
 * the obvious user action — realising you tapped "absent" by mistake — would
 * fail on a constraint violation instead of fixing the record.
 */
export async function markAttendanceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawBlock = formData.get("schedule_block_id");
  const parsed = attendanceSchema.safeParse({
    course_id: formData.get("course_id"),
    // An empty select renders as "", which is not a uuid and not absent.
    schedule_block_id: rawBlock ? String(rawBlock) : undefined,
    class_date: formData.get("class_date"),
    status: formData.get("status"),
    note: formData.get("note"),
  });
  if (!parsed.success) return actionStateFromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("uni_attendance").upsert(
    {
      course_id: parsed.data.course_id,
      schedule_block_id: parsed.data.schedule_block_id ?? null,
      class_date: parsed.data.class_date,
      status: parsed.data.status,
      note: parsed.data.note ?? null,
    },
    { onConflict: "course_id,class_date,schedule_block_id" },
  );
  if (error) {
    // Migration 0038 not applied yet is the one failure worth naming, since
    // the fix is a migration rather than anything the user did wrong.
    return { error: isMissingRelation(error) ? "Attendance isn't set up yet — apply migration 0038." : error.message };
  }

  revalidatePath("/uni/attendance");
  revalidatePath("/uni");
  return {};
}
