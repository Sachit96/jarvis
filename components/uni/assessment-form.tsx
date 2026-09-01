"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createAssessmentAction } from "@/actions/uni-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { ASSESSMENT_TYPES } from "@/lib/validations/uni";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Database } from "@/lib/supabase/database.types";

type Course = Database["public"]["Tables"]["uni_courses"]["Row"];

const TYPE_LABEL: Record<(typeof ASSESSMENT_TYPES)[number], string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  midterm: "Midterm",
  final: "Final",
  presentation: "Presentation",
  participation: "Participation",
};

const initialState: ActionState = {};

/** courses is only needed when there's no fixed courseId (the flat /uni/assessments list) — omit it on a course-detail page where the course is already fixed. */
export function AssessmentForm({ courseId, courses }: { courseId?: string; courses?: Course[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createAssessmentAction, initialState);
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
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New assessment
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New assessment</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          {courseId ? (
            <input type="hidden" name="course_id" value={courseId} />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="course_id">Course</Label>
              <Select name="course_id" required>
                <SelectTrigger id="course_id">
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  {(courses ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id} label={c.code}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="course_id-error" message={state.fieldErrors?.course_id} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="Assignment 2" required autoFocus {...fieldAria(state, "title")} />
            <FieldError id="title-error" message={state.fieldErrors?.title} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue="assignment">
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSESSMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} label={TYPE_LABEL[t]}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due_at">Due</Label>
              <Input id="due_at" name="due_at" type="datetime-local" {...fieldAria(state, "due_at")} />
              <FieldError id="due_at-error" message={state.fieldErrors?.due_at} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="weight_pct">Weight %</Label>
              <Input id="weight_pct" name="weight_pct" type="number" step="0.5" min={0} max={100} required {...fieldAria(state, "weight_pct")} />
              <FieldError id="weight_pct-error" message={state.fieldErrors?.weight_pct} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max_score">Max score</Label>
              <Input id="max_score" name="max_score" type="number" step="1" defaultValue={100} {...fieldAria(state, "max_score")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="difficulty">Difficulty 1-5</Label>
              <Input id="difficulty" name="difficulty" type="number" min={1} max={5} {...fieldAria(state, "difficulty")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="estimated_hours">Estimated hours</Label>
            <Input id="estimated_hours" name="estimated_hours" type="number" step="0.5" min={0} {...fieldAria(state, "estimated_hours")} />
          </div>
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Adding…" : "Add assessment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
