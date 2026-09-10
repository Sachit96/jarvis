import { test } from "node:test";
import assert from "node:assert/strict";
import { personalRecords, volumeByMuscleGroup } from "../lib/health/training";

const exercises = [
  { id: "e1", name: "Squat", muscle_group: "legs" },
  { id: "e2", name: "Bench", muscle_group: "chest" },
  { id: "e3", name: "Odd lift", muscle_group: null },
];
const workouts = [
  { id: "w1", started_at: "2026-09-01T18:00:00.000Z" },
  { id: "w2", started_at: "2026-09-08T18:00:00.000Z" },
];

test("the heaviest set is the record", () => {
  const prs = personalRecords(
    [
      { exercise_id: "e1", workout_id: "w1", weight_kg: 100, reps: 5 },
      { exercise_id: "e1", workout_id: "w2", weight_kg: 120, reps: 3 },
    ],
    exercises,
    workouts,
  );
  assert.equal(prs.length, 1);
  assert.equal(prs[0].weightKg, 120);
  assert.equal(prs[0].achievedAt, "2026-09-08T18:00:00.000Z");
});

test("reps break a tie, so an easier session cannot replace a harder one", () => {
  const prs = personalRecords(
    [
      { exercise_id: "e1", workout_id: "w1", weight_kg: 100, reps: 5 },
      { exercise_id: "e1", workout_id: "w2", weight_kg: 100, reps: 3 },
    ],
    exercises,
    workouts,
  );
  assert.equal(prs[0].reps, 5, "100x5 outranks a later 100x3");
});

test("an incomplete set is not a record", () => {
  const prs = personalRecords(
    [
      { exercise_id: "e1", workout_id: "w1", weight_kg: null, reps: 5 },
      { exercise_id: "e2", workout_id: "w1", weight_kg: 60, reps: null },
    ],
    exercises,
    workouts,
  );
  assert.deepEqual(prs, []);
});

test("records are ordered heaviest first", () => {
  const prs = personalRecords(
    [
      { exercise_id: "e2", workout_id: "w1", weight_kg: 80, reps: 5 },
      { exercise_id: "e1", workout_id: "w1", weight_kg: 140, reps: 5 },
    ],
    exercises,
    workouts,
  );
  assert.deepEqual(prs.map((p) => p.exerciseName), ["Squat", "Bench"]);
});

test("shares always add to 100 because unassigned sets are kept", () => {
  const rows = volumeByMuscleGroup(
    [
      { exercise_id: "e1", workout_id: "w1", weight_kg: 100, reps: 5 }, // 500 legs
      { exercise_id: "e3", workout_id: "w1", weight_kg: 50, reps: 10 }, // 500 unassigned
    ],
    exercises,
  );
  assert.deepEqual(rows.map((r) => r.group).sort(), ["Unassigned", "legs"]);
  assert.equal(Math.round(rows.reduce((s, r) => s + r.share, 0)), 100);
});

test("no sets is an empty breakdown, not a division by zero", () => {
  assert.deepEqual(volumeByMuscleGroup([], exercises), []);
  const rows = volumeByMuscleGroup([{ exercise_id: "e1", workout_id: "w1", weight_kg: null, reps: null }], exercises);
  assert.deepEqual(rows, []);
});
