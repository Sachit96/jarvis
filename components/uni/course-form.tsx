"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { createCourseAction, updateCourseAction } from "@/actions/uni-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { COURSE_COLORS } from "@/lib/validations/uni";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Database } from "@/lib/supabase/database.types";

type Course = Database["public"]["Tables"]["uni_courses"]["Row"];

const initialState: ActionState = {};

export function CourseForm({ course, term }: { course?: Course; term?: string }) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(course?.color ?? COURSE_COLORS[0]);
  const action = course ? updateCourseAction : createCourseAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      if (!course) formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error, course]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          course ? (
            <Button size="sm" variant="secondary" className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New course
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{course ? "Edit course" : "New course"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          {course ? <input type="hidden" name="id" value={course.id} /> : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Course code</Label>
              <Input id="code" name="code" placeholder="QMS 202" defaultValue={course?.code} required autoFocus {...fieldAria(state, "code")} />
              <FieldError id="code-error" message={state.fieldErrors?.code} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="term">Term</Label>
              <Input id="term" name="term" placeholder="Fall 2026" defaultValue={course?.term ?? term} required {...fieldAria(state, "term")} />
              <FieldError id="term-error" message={state.fieldErrors?.term} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Course name</Label>
            <Input id="name" name="name" defaultValue={course?.name} required {...fieldAria(state, "name")} />
            <FieldError id="name-error" message={state.fieldErrors?.name} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="professor">Professor</Label>
              <Input id="professor" name="professor" defaultValue={course?.professor ?? ""} {...fieldAria(state, "professor")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="professor_email">Professor email</Label>
              <Input id="professor_email" name="professor_email" type="email" defaultValue={course?.professor_email ?? ""} {...fieldAria(state, "professor_email")} />
              <FieldError id="professor_email-error" message={state.fieldErrors?.professor_email} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="room">Room</Label>
              <Input id="room" name="room" defaultValue={course?.room ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="credit_weight">Credit weight</Label>
              <Input id="credit_weight" name="credit_weight" type="number" step="0.5" defaultValue={course?.credit_weight ?? 3} {...fieldAria(state, "credit_weight")} />
              <FieldError id="credit_weight-error" message={state.fieldErrors?.credit_weight} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target_grade">Target grade %</Label>
              <Input id="target_grade" name="target_grade" type="number" step="1" min={0} max={100} defaultValue={course?.target_grade ?? ""} {...fieldAria(state, "target_grade")} />
              <FieldError id="target_grade-error" message={state.fieldErrors?.target_grade} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} defaultValue={course?.description ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <input type="hidden" name="color" value={color} />
            <div className="flex flex-wrap gap-2">
              {COURSE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn("h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-card transition-shadow", color === c ? "ring-foreground" : "ring-transparent")}
                  style={{ backgroundColor: c }}
                  aria-label={`Choose color ${c}`}
                />
              ))}
            </div>
          </div>
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : course ? "Save changes" : "Add course"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
