import "server-only";

// Hevy API v1. Schema confirmed against the project's public OpenAPI spec
// this session — GET /v1/workouts requires an `api-key` header (not Bearer)
// and returns { page, page_count, workouts: [...] }. Requires a Hevy Pro
// membership; get a key at https://hevy.com/settings?developer.
const HEVY_BASE_URL = "https://api.hevyapp.com/v1";

export interface HevySet {
  index: number;
  type: string;
  weight_kg: number | null;
  reps: number | null;
}

export interface HevyExercise {
  index: number;
  title: string;
  exercise_template_id: string;
  sets: HevySet[];
}

export interface HevyWorkout {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  exercises: HevyExercise[];
}

interface HevyWorkoutsResponse {
  page: number;
  page_count: number;
  workouts: HevyWorkout[];
}

export function hasHevyKey(): boolean {
  return Boolean(process.env.HEVY_API_KEY);
}

async function hevyFetch(path: string): Promise<unknown> {
  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey) throw new Error("HEVY_API_KEY is not configured");

  const res = await fetch(`${HEVY_BASE_URL}${path}`, {
    headers: { "api-key": apiKey },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hevy API error (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function listRecentHevyWorkouts(pageSize = 10): Promise<HevyWorkout[]> {
  const body = (await hevyFetch(`/workouts?page=1&pageSize=${pageSize}`)) as HevyWorkoutsResponse;
  return body.workouts ?? [];
}
