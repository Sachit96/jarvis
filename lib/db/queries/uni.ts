import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isMissingRelation } from "@/lib/db/missing-relation";

type Client = SupabaseClient<Database>;

// Every read below degrades to an empty list (or null for a single-row
// fetch) if its table doesn't exist yet — migrations 0021/0022 may not be
// applied when this code is already live. Standing rule, not a
// per-function judgment call — see lib/db/missing-relation.ts.

export async function getCourses(supabase: Client, { includeArchived = false }: { includeArchived?: boolean } = {}) {
  let query = supabase.from("uni_courses").select("*").order("term", { ascending: false }).order("code", { ascending: true });
  if (!includeArchived) query = query.eq("archived", false);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

export async function getCourse(supabase: Client, id: string) {
  const { data, error } = await supabase.from("uni_courses").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  return data;
}

export async function getScheduleBlocks(supabase: Client, courseIds?: string[]) {
  let query = supabase.from("uni_schedule_blocks").select("*").order("day_of_week", { ascending: true }).order("start_time", { ascending: true });
  if (courseIds) {
    if (courseIds.length === 0) return [];
    query = query.in("course_id", courseIds);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

export async function getAssessments(supabase: Client, courseIds?: string[]) {
  let query = supabase.from("uni_assessments").select("*").order("due_at", { ascending: true, nullsFirst: false });
  if (courseIds) {
    if (courseIds.length === 0) return [];
    query = query.in("course_id", courseIds);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

export async function getAssessmentGroups(supabase: Client, courseIds?: string[]) {
  let query = supabase.from("uni_assessment_groups").select("*");
  if (courseIds) {
    if (courseIds.length === 0) return [];
    query = query.in("course_id", courseIds);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

export async function getAssessment(supabase: Client, id: string) {
  const { data, error } = await supabase.from("uni_assessments").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  return data;
}

export async function getAssessmentRequirements(supabase: Client, assessmentId: string) {
  const { data, error } = await supabase
    .from("uni_assessment_requirements")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("sort_order", { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

export async function getStudySessions(supabase: Client, courseIds?: string[]) {
  let query = supabase.from("uni_study_sessions").select("*").order("planned_start", { ascending: true });
  if (courseIds) {
    if (courseIds.length === 0) return [];
    query = query.in("course_id", courseIds);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

export async function getMaterials(supabase: Client, courseId: string) {
  const { data, error } = await supabase
    .from("uni_materials")
    .select("*")
    .eq("course_id", courseId)
    .order("uploaded_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

export async function getDeadlines(supabase: Client) {
  const { data, error } = await supabase.from("uni_deadlines").select("*").order("due_at", { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

/** University-wide (course_id null) and per-course no-class date ranges — see uni_no_class_periods, consumed by expandWeeklyOccurrences's caller. */
export async function getNoClassPeriods(supabase: Client) {
  const { data, error } = await supabase.from("uni_no_class_periods").select("*");
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

export async function getFlashcards(supabase: Client, materialId: string) {
  const { data, error } = await supabase.from("uni_flashcards").select("*").eq("material_id", materialId).order("created_at", { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

/** Cards due now, across a set of materials (e.g. every material in a course) — the review queue. */
export async function getDueFlashcards(supabase: Client, materialIds: string[]) {
  if (materialIds.length === 0) return [];
  const { data, error } = await supabase
    .from("uni_flashcards")
    .select("*")
    .in("material_id", materialIds)
    .lte("next_review", new Date().toISOString())
    .order("next_review", { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

/**
 * Attendance records, newest first.
 *
 * Degrades to [] when migration 0038 has not been applied — attendance is
 * additive, and a university module that 500s because one optional table is
 * missing would be a worse failure than showing no attendance.
 */
export async function getAttendance(supabase: Client, courseIds?: string[]) {
  let query = supabase
    .from("uni_attendance")
    .select("*")
    .order("class_date", { ascending: false });
  if (courseIds) {
    if (courseIds.length === 0) return [];
    query = query.in("course_id", courseIds);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}
