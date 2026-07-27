"use client";

import { useActionState, useRef, useEffect } from "react";
import { addWorkoutSetAction, type ActionState } from "@/actions/health-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/lib/supabase/database.types";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

const initialState: ActionState = {};

export function AddSetForm({
  workoutId,
  exercises,
  nextSetNumber,
}: {
  workoutId: string;
  exercises: Exercise[];
  nextSetNumber: number;
}) {
  const [state, formAction, isPending] = useActionState(addWorkoutSetAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  if (exercises.length === 0) {
    return <p className="text-xs text-muted-foreground">Add an exercise before logging sets.</p>;
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="workout_id" value={workoutId} />
      <input type="hidden" name="set_number" value={nextSetNumber} />
      <Select name="exercise_id" defaultValue={exercises[0]?.id}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {exercises.map((ex) => (
            <SelectItem key={ex.id} value={ex.id}>
              {ex.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input name="weight_kg" type="number" step="0.5" min="0" placeholder="kg" className="w-20" />
      <Input name="reps" type="number" step="1" min="0" placeholder="reps" className="w-20" />
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
        {isPending ? "Adding…" : `Add set ${nextSetNumber}`}
      </Button>
      {state.error ? <p className="w-full text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
