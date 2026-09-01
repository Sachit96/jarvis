import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export async function getCourses(supabase: Client, { includeArchived = false }: { includeArchived?: boolean } = {}) {
  let query = supabase.from("uni_courses").select("*").order("term", { ascending: false }).order("code", { ascending: true });
  if (!includeArchived) query = query.eq("archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getCourse(supabase: Client, id: string) {
  const { data, error } = await supabase.from("uni_courses").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getScheduleBlocks(supabase: Client, courseIds?: string[]) {
  let query = supabase.from("uni_schedule_blocks").select("*").order("day_of_week", { ascending: true }).order("start_time", { ascending: true });
  if (courseIds) {
    if (courseIds.length === 0) return [];
    query = query.in("course_id", courseIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getAssessments(supabase: Client, courseIds?: string[]) {
  let query = supabase.from("uni_assessments").select("*").order("due_at", { ascending: true, nullsFirst: false });
  if (courseIds) {
    if (courseIds.length === 0) return [];
    query = query.in("course_id", courseIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getAssessment(supabase: Client, id: string) {
  const { data, error } = await supabase.from("uni_assessments").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAssessmentRequirements(supabase: Client, assessmentId: string) {
  const { data, error } = await supabase
    .from("uni_assessment_requirements")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getStudySessions(supabase: Client, courseIds?: string[]) {
  let query = supabase.from("uni_study_sessions").select("*").order("planned_start", { ascending: true });
  if (courseIds) {
    if (courseIds.length === 0) return [];
    query = query.in("course_id", courseIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getMaterials(supabase: Client, courseId: string) {
  const { data, error } = await supabase
    .from("uni_materials")
    .select("*")
    .eq("course_id", courseId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getDeadlines(supabase: Client) {
  const { data, error } = await supabase.from("uni_deadlines").select("*").order("due_at", { ascending: true });
  if (error) throw error;
  return data;
}
