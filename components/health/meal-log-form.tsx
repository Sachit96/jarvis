"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createNutritionLogAction } from "@/actions/health-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { todayStr } from "@/lib/date";
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
                  <SelectItem value="breakfast" label="Breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch" label="Lunch">Lunch</SelectItem>
                  <SelectItem value="dinner" label="Dinner">Dinner</SelectItem>
                  <SelectItem value="snack" label="Snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="calories">Calories</Label>
              <Input id="calories" name="calories" type="number" min="0" required {...fieldAria(state, "calories")} />
              <FieldError id="calories-error" message={state.fieldErrors?.calories} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              placeholder="Grilled chicken salad"
              required
              autoFocus
              {...fieldAria(state, "description")}
            />
            <FieldError id="description-error" message={state.fieldErrors?.description} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="protein_g">Protein (g)</Label>
              <Input id="protein_g" name="protein_g" type="number" step="0.1" min="0" defaultValue="0" {...fieldAria(state, "protein_g")} />
              <FieldError id="protein_g-error" message={state.fieldErrors?.protein_g} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="carbs_g">Carbs (g)</Label>
              <Input id="carbs_g" name="carbs_g" type="number" step="0.1" min="0" defaultValue="0" {...fieldAria(state, "carbs_g")} />
              <FieldError id="carbs_g-error" message={state.fieldErrors?.carbs_g} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fat_g">Fat (g)</Label>
              <Input id="fat_g" name="fat_g" type="number" step="0.1" min="0" defaultValue="0" {...fieldAria(state, "fat_g")} />
              <FieldError id="fat_g-error" message={state.fieldErrors?.fat_g} />
            </div>
          </div>
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Logging…" : "Log meal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
