"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { ChevronDown, ListChecks, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createAssessmentRequirementAction,
  deleteAssessmentRequirementAction,
  getAssessmentRequirementsAction,
  toggleAssessmentRequirementAction,
} from "@/actions/uni-actions";

interface Requirement {
  id: string;
  requirement: string;
  completed: boolean;
}

/**
 * An assessment's requirement checklist.
 *
 * These rows already existed: the AI assignment breakdown
 * (confirmAssignmentBreakdownAction) has been writing them into
 * uni_assessment_requirements since it shipped, and nothing has ever
 * displayed them — you could hand JARVIS an assignment brief, watch it
 * extract the deliverables, save them, and never see the list again.
 *
 * Loaded on expand rather than with the row, so a list of twenty
 * assessments does not fire twenty queries to render checkboxes nobody
 * opened. Items can also be added by hand, because a brief is not always
 * what you have.
 */
export function AssessmentRequirements({ assessmentId }: { assessmentId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Requirement[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [addState, addAction, isAdding] = useActionState(createAssessmentRequirementAction, {});

  function load() {
    startTransition(async () => {
      setItems(await getAssessmentRequirementsAction(assessmentId));
    });
  }

  function handleToggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && items === null) load();
  }

  function toggle(id: string, completed: boolean) {
    setItems((prev) => prev?.map((r) => (r.id === id ? { ...r, completed } : r)) ?? prev);
    startTransition(async () => {
      try {
        await toggleAssessmentRequirementAction(id, completed);
      } catch {
        setItems((prev) => prev?.map((r) => (r.id === id ? { ...r, completed: !completed } : r)) ?? prev);
      }
    });
  }

  function remove(id: string) {
    const snapshot = items;
    setItems((prev) => prev?.filter((r) => r.id !== id) ?? prev);
    startTransition(async () => {
      try {
        await deleteAssessmentRequirementAction(id);
      } catch {
        setItems(snapshot);
      }
    });
  }

  const doneCount = items?.filter((r) => r.completed).length ?? 0;

  return (
    <div className="w-full">
      <button
        onClick={handleToggleOpen}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-caption font-medium text-brand hover:underline"
      >
        <ListChecks className="size-3.5" strokeWidth={2} />
        Requirements
        {items && items.length > 0 ? (
          <span className="tabular text-foreground-tertiary">
            {doneCount}/{items.length}
          </span>
        ) : null}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} strokeWidth={2.5} />
      </button>

      {open ? (
        <div className={cn("mt-2 space-y-2", isPending && "opacity-70")}>
          {items === null ? (
            <p className="text-caption text-foreground-tertiary">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-caption text-foreground-tertiary">
              Nothing listed yet. Add a deliverable below, or use the breakdown to pull them out of the brief.
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((r) => (
                <li key={r.id} className="flex items-start gap-2 text-caption">
                  <input
                    type="checkbox"
                    checked={r.completed}
                    onChange={(e) => toggle(r.id, e.target.checked)}
                    aria-label={r.requirement}
                    className="mt-0.5 size-3.5 shrink-0 accent-[var(--brand)]"
                  />
                  <span className={cn("min-w-0 flex-1", r.completed && "text-foreground-tertiary line-through")}>
                    {r.requirement}
                  </span>
                  <button
                    onClick={() => remove(r.id)}
                    aria-label={`Remove "${r.requirement}"`}
                    className="relative shrink-0 text-foreground-tertiary transition-colors after:absolute after:-inset-2.5 hover:text-danger"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            action={(formData) => {
              addAction(formData);
              // The action revalidates the route, but this list is client
              // state loaded on demand, so it has to be re-read itself.
              startTransition(async () => {
                setItems(await getAssessmentRequirementsAction(assessmentId));
              });
            }}
            className="flex items-center gap-1.5"
          >
            <input type="hidden" name="assessment_id" value={assessmentId} />
            <Input
              name="requirement"
              required
              maxLength={200}
              placeholder="Add a deliverable…"
              className="h-8 text-caption"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={isAdding} aria-label="Add requirement">
              <Plus className="size-3.5" />
            </Button>
          </form>
          {addState.error ? <p className="text-caption text-danger">{addState.error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
