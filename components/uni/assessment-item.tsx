"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { recordGradeAction, setAssessmentStatusAction, deleteAssessmentAction } from "@/actions/uni-actions";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASSESSMENT_STATUSES } from "@/lib/validations/uni";
import type { Database } from "@/lib/supabase/database.types";

type Assessment = Database["public"]["Tables"]["uni_assessments"]["Row"];

const STATUS_LABEL: Record<(typeof ASSESSMENT_STATUSES)[number], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  graded: "Graded",
};

function formatDue(due_at: string | null) {
  if (!due_at) return "No due date";
  const d = new Date(due_at);
  const overdue = d.getTime() < Date.now();
  const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return { label, overdue };
}

export function AssessmentItem({ assessment, courseCode, courseColor }: { assessment: Assessment; courseCode?: string; courseColor?: string }) {
  const [isPending, startTransition] = useTransition();
  const [score, setScore] = useState(assessment.earned_score != null ? String(assessment.earned_score) : "");
  const due = formatDue(assessment.due_at);
  const isGraded = assessment.status === "graded" && assessment.earned_score != null;

  function submitGrade() {
    const n = Number(score);
    if (!Number.isFinite(n) || n < 0) return;
    startTransition(() => recordGradeAction(assessment.id, n, assessment.course_id));
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
      {courseColor ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: courseColor }} /> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {courseCode ? <span className="text-muted-foreground">{courseCode} · </span> : null}
          {assessment.title}
        </p>
        <p className={cn("text-caption", typeof due === "object" && due.overdue && assessment.status !== "graded" && assessment.status !== "submitted" ? "text-danger" : "text-muted-foreground")}>
          {typeof due === "string" ? due : due.label} · {assessment.weight_pct}%
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          step="0.5"
          min={0}
          placeholder={`/${assessment.max_score}`}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          onBlur={submitGrade}
          className={cn("h-8 w-20 text-sm", isGraded && "border-success/40")}
          disabled={isPending}
        />
      </div>

      <Select
        value={assessment.status}
        onValueChange={(v) => {
          if (!v) return;
          startTransition(() => setAssessmentStatusAction(assessment.id, v, assessment.course_id));
        }}
      >
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ASSESSMENT_STATUSES.map((s) => (
            <SelectItem key={s} value={s} label={STATUS_LABEL[s]}>
              {STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={() => startTransition(() => deleteAssessmentAction(assessment.id, assessment.course_id))}
        className="text-muted-foreground/60 hover:text-danger"
        aria-label="Delete assessment"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
