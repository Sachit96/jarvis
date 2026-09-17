import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isMissingRelation } from "@/lib/db/missing-relation";
import { getCourses, getScheduleBlocks } from "@/lib/db/queries/uni";

type Client = SupabaseClient<Database>;

export interface LifeScheduleBlockRow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  label: string;
  category: string;
  notes: string | null;
}

export async function getLifeScheduleBlocks(supabase: Client): Promise<LifeScheduleBlockRow[]> {
  const { data, error } = await supabase
    .from("life_schedule_blocks")
    .select("*")
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data;
}

export interface WeekBlock {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  label: string;
  /** One of LIFE_SCHEDULE_CATEGORIES, or "class" for a merged-in class block. */
  category: string;
  /** Room for a class block, notes for a life block. */
  detail: string | null;
  kind: "life" | "class";
}

/**
 * One week, both sources merged: the standing personal routine
 * (life_schedule_blocks) plus class times (uni_schedule_blocks, joined to
 * course code). Merged here rather than in the component so nothing that
 * renders "the week" needs to know there are two tables behind it — same
 * reasoning as getTodayRoutineItems's auto items.
 */
export async function getWeekSchedule(supabase: Client): Promise<WeekBlock[]> {
  const courses = await getCourses(supabase);
  const [lifeBlocks, classBlocks] = await Promise.all([
    getLifeScheduleBlocks(supabase),
    getScheduleBlocks(
      supabase,
      courses.map((c) => c.id),
    ),
  ]);
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const life: WeekBlock[] = lifeBlocks.map((b) => ({
    id: `life-${b.id}`,
    day_of_week: b.day_of_week,
    start_time: b.start_time,
    end_time: b.end_time,
    label: b.label,
    category: b.category,
    detail: b.notes,
    kind: "life",
  }));

  const classes: WeekBlock[] = classBlocks.map((b) => {
    const course = courseById.get(b.course_id);
    return {
      id: `class-${b.id}`,
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
      label: course?.code ?? "Class",
      category: "class",
      detail: b.room,
      kind: "class" as const,
    };
  });

  return [...life, ...classes];
}
