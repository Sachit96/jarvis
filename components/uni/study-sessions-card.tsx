"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import {
  BUCKET_LABEL,
  formatMinutes,
  groupSessions,
  todaysPlan,
  totalsFor,
  type SessionBucket,
  type StudySessionLike,
} from "@/lib/uni/study-sessions";
import {
  deleteStudySessionAction,
  toggleStudySessionCompletedAction,
} from "@/actions/uni-actions";

export interface StudySessionRow extends StudySessionLike {
  courseCode: string;
  assessmentTitle: string | null;
}

/** Order the buckets are read in: what you missed, what is tonight, what is next. */
const ORDER: SessionBucket[] = ["overdue", "today", "upcoming", "done"];

function startLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/**
 * The study plan, read back.
 *
 * "Plan tonight" and the AI assignment breakdown both write rows into
 * uni_study_sessions, and until now nothing ever read them: you could ask
 * JARVIS what to work on, save the plan, and never see it again. Every query
 * and action this uses already existed — getStudySessions,
 * toggleStudySessionCompletedAction and deleteStudySessionAction were all
 * written and then never wired to anything.
 *
 * Completion is optimistic against the same pattern the task board uses, and
 * reverts if the write fails; a plan you tick off should not wait on a round
 * trip.
 */
export function StudySessionsCard({ sessions }: { sessions: StudySessionRow[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const visible = sessions
    .filter((s) => !removed[s.id])
    .map((s) => ({ ...s, completed: done[s.id] ?? s.completed }));

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const grouped = groupSessions(visible, today);
  const todayTotals = totalsFor(todaysPlan(visible, today));

  function toggle(id: string, next: boolean) {
    setDone((prev) => ({ ...prev, [id]: next }));
    startTransition(async () => {
      try {
        await toggleStudySessionCompletedAction(id, next);
      } catch {
        setDone((prev) => ({ ...prev, [id]: !next }));
      }
    });
  }

  function remove(id: string) {
    setRemoved((prev) => ({ ...prev, [id]: true }));
    startTransition(async () => {
      try {
        await deleteStudySessionAction(id);
      } catch {
        setRemoved((prev) => ({ ...prev, [id]: false }));
      }
    });
  }

  if (visible.length === 0) {
    return (
      <Card padding="compact">
        <p className="eyebrow">Study plan</p>
        <EmptyState
          compact
          icon={CalendarClock}
          title="No sessions planned"
          description="Plan an evening above, or break an assignment down, and the blocks land here to tick off."
        />
      </Card>
    );
  }

  return (
    <Card padding="compact" className={cn(isPending && "opacity-70")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">Study plan</p>
        {todayTotals.totalCount > 0 ? (
          <p className="text-caption text-foreground-tertiary">
            <span className="tabular text-foreground">
              {formatMinutes(todayTotals.completedMinutes)}
            </span>{" "}
            of {formatMinutes(todayTotals.plannedMinutes)} done today
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {ORDER.map((bucket) => {
          const rows = grouped[bucket];
          if (rows.length === 0) return null;
          return (
            <section key={bucket} className="space-y-1.5">
              <p className={cn("eyebrow", bucket === "overdue" && "text-danger")}>
                {BUCKET_LABEL[bucket]}
                <span className="ml-2 text-foreground-tertiary">{rows.length}</span>
              </p>
              <ul className="space-y-1.5">
                {rows.map((s) => (
                  <li
                    key={s.id}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg bg-white/[0.03] px-3 py-2",
                      s.completed && "opacity-60",
                    )}
                  >
                    <Checkbox
                      checked={s.completed}
                      onCheckedChange={(c) => toggle(s.id, c === true)}
                      className="mt-0.5"
                      aria-label={`Mark ${s.courseCode} study block ${s.completed ? "not done" : "done"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-body", s.completed && "line-through")}>
                        <span className="text-foreground-tertiary">{s.courseCode} · </span>
                        {s.assessmentTitle ?? "Study block"}
                      </p>
                      <p className="tabular mt-0.5 text-caption text-foreground-tertiary">
                        {bucket === "today" ? startLabel(s.planned_start) : dateLabel(s.planned_start)}
                        {" · "}
                        {formatMinutes(s.actual_minutes ?? s.planned_minutes)}
                        {s.notes ? ` · ${s.notes}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(s.id)}
                      aria-label="Remove study block"
                      className="relative shrink-0 text-foreground-tertiary transition-colors after:absolute after:-inset-3 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Card>
  );
}
