"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { createAssessmentAction, updateAssessmentAction } from "@/actions/uni-actions";
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
type Assessment = Database["public"]["Tables"]["uni_assessments"]["Row"];
type Group = Database["public"]["Tables"]["uni_assessment_groups"]["Row"];

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in LOCAL time; a stored UTC ISO string would shift the hour. */
function toLocalDateTimeValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TYPE_LABEL: Record<(typeof ASSESSMENT_TYPES)[number], string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  midterm: "Midterm",
  final: "Final",
  presentation: "Presentation",
  participation: "Participation",
};

const initialState: ActionState = {};

/**
 * Base UI's Select treats "" as "no value" and refuses to render an item
 * for it, so "Ungrouped" needs a real value. The action's schema maps
 * anything non-uuid to undefined → SQL NULL, so this sentinel round-trips
 * to "no group" without a special case on the server.
 */
const UNGROUPED = "none";

/**
 * Create or edit an assessment.
 *
 * One form for both because the fields are identical and a second
 * near-copy is how the two drift apart — the create dialog gaining a
 * difficulty field the edit dialog never got, and so on. Pass
 * `assessment` to edit; omit it to create.
 *
 * `courses` is only needed when there's no fixed courseId (the flat
 * /uni/assessments list) — omit it on a course-detail page where the
 * course is already fixed.
 */
export function AssessmentForm({
  courseId,
  courses,
  assessment,
  groups,
}: {
  courseId?: string;
  courses?: Course[];
  assessment?: Assessment;
  /** Grading groups for the fixed course, when there is one. Omitted on the flat list. */
  groups?: Group[];
}) {
  const isEdit = assessment != null;
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateAssessmentAction : createAssessmentAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      // Only a create form clears itself. Resetting an edit form repopulates
      // it from the ORIGINAL defaults, which flashes the pre-edit values
      // back on screen as the dialog closes.
      if (!isEdit) formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button size="icon" variant="ghost" aria-label={`Edit ${assessment.title}`}>
              <Pencil className="size-4" />
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New assessment
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit assessment" : "New assessment"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          {isEdit ? <input type="hidden" name="id" value={assessment.id} /> : null}
          {courseId ? (
            <input type="hidden" name="course_id" value={courseId} />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="course_id">Course</Label>
              <Select name="course_id" defaultValue={assessment?.course_id} required>
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
            <Input
              id="title"
              name="title"
              placeholder="Assignment 2"
              defaultValue={assessment?.title}
              required
              autoFocus
              {...fieldAria(state, "title")}
            />
            <FieldError id="title-error" message={state.fieldErrors?.title} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue={assessment?.type ?? "assignment"}>
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
              <Input
                id="due_at"
                name="due_at"
                type="datetime-local"
                defaultValue={toLocalDateTimeValue(assessment?.due_at ?? null)}
                {...fieldAria(state, "due_at")}
              />
              <FieldError id="due_at-error" message={state.fieldErrors?.due_at} />
            </div>
          </div>
          {groups && groups.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="group_id">Grading group</Label>
              {/* Base UI's Select has no empty-string item, so "Ungrouped"
                  carries the sentinel and the hidden input below is what the
                  form actually submits. */}
              <Select name="group_id" defaultValue={assessment?.group_id ?? UNGROUPED}>
                <SelectTrigger id="group_id">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNGROUPED} label="Ungrouped">
                    Ungrouped
                  </SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id} label={g.label}>
                      {g.label}
                      {g.drop_lowest_count > 0 ? ` · drops ${g.drop_lowest_count}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="weight_pct">Weight %</Label>
              <Input
                id="weight_pct"
                name="weight_pct"
                type="number"
                step="0.5"
                min={0}
                max={100}
                defaultValue={assessment?.weight_pct ?? undefined}
                required
                {...fieldAria(state, "weight_pct")}
              />
              <FieldError id="weight_pct-error" message={state.fieldErrors?.weight_pct} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max_score">Max score</Label>
              <Input
                id="max_score"
                name="max_score"
                type="number"
                step="1"
                defaultValue={assessment?.max_score ?? 100}
                {...fieldAria(state, "max_score")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="difficulty">Difficulty 1-5</Label>
              <Input
                id="difficulty"
                name="difficulty"
                type="number"
                min={1}
                max={5}
                defaultValue={assessment?.difficulty ?? undefined}
                {...fieldAria(state, "difficulty")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="estimated_hours">Estimated hours</Label>
            <Input
              id="estimated_hours"
              name="estimated_hours"
              type="number"
              step="0.5"
              min={0}
              defaultValue={assessment?.estimated_hours ?? undefined}
              {...fieldAria(state, "estimated_hours")}
            />
          </div>
          {state.error ? (
            <p className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Add assessment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
