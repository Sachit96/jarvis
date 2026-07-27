"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createExerciseAction, type ActionState } from "@/actions/health-actions";
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

const initialState: ActionState = {};

export function ExerciseForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createExerciseAction, initialState);
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
            <Plus className="h-4 w-4" /> New exercise
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New exercise</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="muscle_group">Muscle group</Label>
            <Input id="muscle_group" name="muscle_group" placeholder="Chest, Legs, Cardio…" />
          </div>
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Adding…" : "Add exercise"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
