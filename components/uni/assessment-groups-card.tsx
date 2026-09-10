"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Layers, Plus, Trash2 } from "lucide-react";
import {
  createAssessmentGroupAction,
  deleteAssessmentGroupAction,
} from "@/actions/uni-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Database } from "@/lib/supabase/database.types";

type Group = Database["public"]["Tables"]["uni_assessment_groups"]["Row"];

const initialState: ActionState = {};

/**
 * Best-N-of-M buckets for one course.
 *
 * The grading engine has always understood these — "quizzes, lowest two
 * dropped" changes every projection on the course — but there was no way to
 * create one, so the feature was unreachable and every such course was
 * graded pessimistically.
 */
export function AssessmentGroupsCard({
  courseId,
  groups,
  memberCounts,
}: {
  courseId: string;
  groups: Group[];
  /** How many assessments currently sit in each group, keyed by group id. */
  memberCounts: Map<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createAssessmentGroupAction, initialState);
  const [, startTransition] = useTransition();
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
    <Card padding="slotted">
      <div className="px-(--card-spacing)">
        <SectionHeader
          title="Grading groups"
          description="Buckets where the lowest scores are dropped, as the syllabus describes them."
          action={
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button size="sm" variant="secondary" className="gap-1.5">
                    <Plus className="size-4" /> Group
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New grading group</DialogTitle>
                </DialogHeader>
                <form ref={formRef} action={formAction} className="space-y-4">
                  <input type="hidden" name="course_id" value={courseId} />
                  <div className="space-y-1.5">
                    <Label htmlFor="label">Label</Label>
                    <Input
                      id="label"
                      name="label"
                      placeholder="Quizzes"
                      required
                      autoFocus
                      {...fieldAria(state, "label")}
                    />
                    <FieldError id="label-error" message={state.fieldErrors?.label} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="drop_lowest_count">Drop lowest</Label>
                    <Input
                      id="drop_lowest_count"
                      name="drop_lowest_count"
                      type="number"
                      min={0}
                      max={20}
                      defaultValue={1}
                      {...fieldAria(state, "drop_lowest_count")}
                    />
                    <p className="text-caption text-foreground-tertiary">
                      How many of the group&apos;s lowest graded scores to exclude. 0 groups the
                      assessments without changing any calculation.
                    </p>
                    <FieldError
                      id="drop_lowest_count-error"
                      message={state.fieldErrors?.drop_lowest_count}
                    />
                  </div>
                  {state.error ? (
                    <p className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger">
                      {state.error}
                    </p>
                  ) : null}
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? "Adding…" : "Add group"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          }
        />
      </div>

      <div className="px-(--card-spacing)">
        {groups.length === 0 ? (
          <EmptyState
            compact
            icon={Layers}
            title="No grading groups"
            description="If the syllabus drops your lowest quiz, add a group here and assign the quizzes to it."
          />
        ) : (
          <ul className="space-y-2.5">
            {groups.map((group) => {
              const members = memberCounts.get(group.id) ?? 0;
              return (
                <li key={group.id} className="group/grp flex items-center gap-3 text-body">
                  <span className="min-w-0 flex-1 truncate text-foreground">{group.label}</span>
                  <span className="shrink-0 text-caption text-foreground-tertiary">
                    {members} {members === 1 ? "assessment" : "assessments"}
                    {group.drop_lowest_count > 0
                      ? ` · best ${Math.max(0, members - group.drop_lowest_count)}`
                      : " · no drop"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(() => deleteAssessmentGroupAction(group.id, courseId))
                    }
                    aria-label={`Delete group ${group.label}`}
                    className="relative shrink-0 text-foreground-tertiary opacity-0 transition-opacity after:absolute after:-inset-3 group-hover/grp:opacity-100 hover:text-danger focus-visible:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
