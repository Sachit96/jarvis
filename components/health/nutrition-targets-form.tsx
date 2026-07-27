"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { upsertNutritionTargetsAction, type ActionState } from "@/actions/health-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Database } from "@/lib/supabase/database.types";

type Targets = Database["public"]["Tables"]["nutrition_targets"]["Row"];

const initialState: ActionState = {};

export function NutritionTargetsForm({ targets }: { targets: Targets | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(upsertNutritionTargetsAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="secondary" className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Edit targets
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Daily targets</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="target_calories">Calories</Label>
              <Input
                id="target_calories"
                name="target_calories"
                type="number"
                min="0"
                defaultValue={targets?.target_calories ?? 2000}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target_protein_g">Protein (g)</Label>
              <Input
                id="target_protein_g"
                name="target_protein_g"
                type="number"
                min="0"
                defaultValue={targets?.target_protein_g ?? 150}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target_carbs_g">Carbs (g)</Label>
              <Input
                id="target_carbs_g"
                name="target_carbs_g"
                type="number"
                min="0"
                defaultValue={targets?.target_carbs_g ?? 200}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target_fat_g">Fat (g)</Label>
              <Input
                id="target_fat_g"
                name="target_fat_g"
                type="number"
                min="0"
                defaultValue={targets?.target_fat_g ?? 65}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target_water_ml">Water (ml)</Label>
            <Input
              id="target_water_ml"
              name="target_water_ml"
              type="number"
              min="0"
              defaultValue={targets?.target_water_ml ?? 2500}
              required
            />
          </div>
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Save targets"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
