/**
 * Training analytics over the sets already in the database.
 *
 * Pure functions, no queries: the Health page already reads every set it
 * needs to render its history, so these derive the interesting numbers from
 * rows that are in hand rather than adding round trips.
 *
 * Weight is stored in kg (`weight_kg`) regardless of what the UI displays;
 * everything here stays in kg and the caller formats.
 */

export interface SetLike {
  exercise_id: string;
  workout_id: string;
  reps: number | null;
  weight_kg: number | null;
}

export interface WorkoutLike {
  id: string;
  started_at: string;
}

export interface ExerciseLike {
  id: string;
  name: string;
  muscle_group: string | null;
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  /** Heaviest single set, in kg. */
  weightKg: number;
  reps: number;
  /** When it was set — the workout the set belongs to. */
  achievedAt: string | null;
}

/**
 * The heaviest set logged per exercise.
 *
 * Heaviest weight wins; reps break a tie, because 100kg x 5 is a better set
 * than 100kg x 3 and treating them as equal would let an easier session
 * silently replace a harder one. A set with no weight or no reps is not a
 * record — it is an incomplete row.
 */
export function personalRecords(
  sets: SetLike[],
  exercises: ExerciseLike[],
  workouts: WorkoutLike[],
): PersonalRecord[] {
  const nameById = new Map(exercises.map((e) => [e.id, e.name]));
  const dateById = new Map(workouts.map((w) => [w.id, w.started_at]));
  const best = new Map<string, PersonalRecord>();

  for (const set of sets) {
    if (set.weight_kg == null || set.reps == null) continue;
    const current = best.get(set.exercise_id);
    const better =
      !current ||
      set.weight_kg > current.weightKg ||
      (set.weight_kg === current.weightKg && set.reps > current.reps);
    if (!better) continue;
    best.set(set.exercise_id, {
      exerciseId: set.exercise_id,
      exerciseName: nameById.get(set.exercise_id) ?? "Exercise",
      weightKg: set.weight_kg,
      reps: set.reps,
      achievedAt: dateById.get(set.workout_id) ?? null,
    });
  }

  return [...best.values()].sort((a, b) => b.weightKg - a.weightKg);
}

export interface MuscleGroupVolume {
  group: string;
  volumeKg: number;
  setCount: number;
  /** Share of total volume, 0-100. */
  share: number;
}

/**
 * Volume per muscle group — weight x reps, summed.
 *
 * Sets whose exercise has no muscle group are grouped under "Unassigned"
 * rather than dropped, so the shares always add to the real total. Silently
 * discarding them would make the breakdown quietly disagree with the volume
 * figure shown beside it.
 */
export function volumeByMuscleGroup(sets: SetLike[], exercises: ExerciseLike[]): MuscleGroupVolume[] {
  const groupById = new Map(exercises.map((e) => [e.id, e.muscle_group?.trim() || "Unassigned"]));
  const totals = new Map<string, { volumeKg: number; setCount: number }>();

  for (const set of sets) {
    if (set.weight_kg == null || set.reps == null) continue;
    const group = groupById.get(set.exercise_id) ?? "Unassigned";
    const entry = totals.get(group) ?? { volumeKg: 0, setCount: 0 };
    entry.volumeKg += set.weight_kg * set.reps;
    entry.setCount += 1;
    totals.set(group, entry);
  }

  const total = [...totals.values()].reduce((sum, t) => sum + t.volumeKg, 0);
  return [...totals.entries()]
    .map(([group, t]) => ({
      group,
      volumeKg: t.volumeKg,
      setCount: t.setCount,
      // No division by zero, and no NaN reaching a style attribute.
      share: total > 0 ? (t.volumeKg / total) * 100 : 0,
    }))
    .sort((a, b) => b.volumeKg - a.volumeKg);
}
