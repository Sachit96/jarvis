"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteWorkoutSetAction } from "@/actions/health-actions";
import { formatLbs } from "@/lib/units";
import type { Database } from "@/lib/supabase/database.types";

type WorkoutSet = Database["public"]["Tables"]["workout_sets"]["Row"];

export function WorkoutSetItem({ set, exerciseName }: { set: WorkoutSet; exerciseName: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(() => deleteWorkoutSetAction(set.id));
  }

  return (
    <li className={cn("flex items-center justify-between gap-2 text-sm", isPending && "opacity-50")}>
      <span className="text-muted-foreground">
        Set {set.set_number} · <span className="text-foreground">{exerciseName}</span>
        {set.weight_kg !== null ? ` · ${formatLbs(Number(set.weight_kg), 1)} lbs` : ""}
        {set.reps !== null ? ` × ${set.reps}` : ""}
      </span>
      <button onClick={handleDelete} aria-label="Delete set" className="text-muted-foreground hover:text-danger">
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
