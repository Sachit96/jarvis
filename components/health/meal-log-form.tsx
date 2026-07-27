"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createNutritionLogAction, type ActionState } from "@/actions/health-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const initialState: ActionState = {};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function MealLogForm({ defaultMealType }: { defaultMealType: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createNutritionLogAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="secondary" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a meal</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="logged_at" value={todayStr()} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="meal_type">Meal</Label>
              <Select name="meal_type" defaultValue={defaultMealType}>
                <SelectTrigger id="meal_type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="calories">Calories</Label>
              <Input id="calories" name="calories" type="number" min="0" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="Grilled chicken salad" required autoFocus />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="protein_g">Protein (g)</Label>
              <Input id="protein_g" name="protein_g" type="number" step="0.1" min="0" defaultValue="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="carbs_g">Carbs (g)</Label>
              <Input id="carbs_g" name="carbs_g" type="number" step="0.1" min="0" defaultValue="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fat_g">Fat (g)</Label>
              <Input id="fat_g" name="fat_g" type="number" step="0.1" min="0" defaultValue="0" />
            </div>
          </div>
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Logging…" : "Log meal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
