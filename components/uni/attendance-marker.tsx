"use client";

import { useActionState } from "react";
import { Check, X, Clock, FileCheck, Ban } from "lucide-react";
import { markAttendanceAction } from "@/actions/uni-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/uni/timetable";
import type { AttendanceStatus } from "@/lib/uni/attendance";

export interface TodayClass {
  scheduleBlockId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  startTime: string;
  endTime: string;
  room: string | null;
  /** Whatever is already recorded for this class today. */
  status: AttendanceStatus | null;
}

/**
 * Marks today's classes.
 *
 * The whole point of one tap per class: attendance only gets recorded if
 * recording it is trivial. A form with a course picker and a date field would
 * be accurate and never used.
 *
 * Today's classes come from the timetable, so there is nothing to type — the
 * only decision left is which button.
 */

const OPTIONS: { status: AttendanceStatus; label: string; icon: typeof Check; tone: string }[] = [
  { status: "present", label: "Present", icon: Check, tone: "text-success border-success/40 bg-success/10" },
  { status: "late", label: "Late", icon: Clock, tone: "text-warn border-warn/40 bg-warn/10" },
  { status: "absent", label: "Absent", icon: X, tone: "text-danger border-danger/40 bg-danger/10" },
  { status: "excused", label: "Excused", icon: FileCheck, tone: "text-brand border-brand/40 bg-brand/10" },
  { status: "cancelled", label: "Cancelled", icon: Ban, tone: "text-muted-foreground border-border bg-muted/40" },
];

export function AttendanceMarker({ classes, date }: { classes: TodayClass[]; date: string }) {
  if (classes.length === 0) {
    return (
      <Card padding="slotted">
        <CardHeader>
          <CardTitle>No classes today</CardTitle>
          <CardDescription>
            Nothing on the timetable for today, so there is nothing to mark.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card padding="slotted">
      <CardHeader>
        <CardTitle>Today&rsquo;s classes</CardTitle>
        <CardDescription>
          One tap each. Marking the same class again corrects it rather than adding a second record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {classes.map((item) => (
          <ClassRow key={item.scheduleBlockId} item={item} date={date} />
        ))}
      </CardContent>
    </Card>
  );
}

function ClassRow({ item, date }: { item: TodayClass; date: string }) {
  const [state, formAction, pending] = useActionState(markAttendanceAction, {});

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-body font-medium">
            {item.courseCode}
            <span className="ml-2 font-normal text-muted-foreground">{item.courseName}</span>
          </p>
          <p className="text-caption text-muted-foreground">
            {formatTime(item.startTime)}–{formatTime(item.endTime)}
            {item.room ? ` · ${item.room}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = item.status === option.status;
            return (
              <form key={option.status} action={formAction}>
                <input type="hidden" name="course_id" value={item.courseId} />
                <input type="hidden" name="schedule_block_id" value={item.scheduleBlockId} />
                <input type="hidden" name="class_date" value={date} />
                <input type="hidden" name="status" value={option.status} />
                <button
                  type="submit"
                  disabled={pending}
                  // aria-pressed rather than colour alone: the selected state
                  // has to reach a screen reader too.
                  aria-pressed={selected}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-1 text-caption transition disabled:opacity-50",
                    selected ? option.tone : "border-border text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={2} />
                  {option.label}
                </button>
              </form>
            );
          })}
        </div>
      </div>

      {state.error ? <p className="mt-2 text-caption text-danger">{state.error}</p> : null}
    </div>
  );
}
