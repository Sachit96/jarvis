"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  byDay, gridRange, formatTime, toMinutes, nowContext, currentBlock, nextClass,
  describeUntil, DAY_LABELS, type TimetableBlock,
} from "@/lib/uni/timetable";

export interface TimetableCourse {
  id: string;
  code: string;
  name: string;
  color: string | null;
}

/**
 * The week at a glance, with the current and next class called out.
 *
 * A client component for one reason only: "what is on right now" changes
 * while the page is open, and a server-rendered answer would be wrong within
 * the hour. Everything it needs arrives as props — no fetching here.
 *
 * The grid is absolute-positioned within each day column rather than a table,
 * because a lecture is a range (09:00–10:30), not a cell: a table would
 * either round every class to the hour or need row-spanning arithmetic that
 * breaks the moment a class starts at :20.
 */

/**
 * A Date that only changes identity when the MINUTE changes.
 *
 * useSyncExternalStore compares snapshots by reference, so returning a fresh
 * `new Date()` on every read would loop forever. Caching per minute gives a
 * stable reference between ticks.
 */
let minuteCache: { key: string; value: Date } | null = null;

function getMinuteSnapshot(): Date {
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  if (!minuteCache || minuteCache.key !== key) minuteCache = { key, value: now };
  return minuteCache.value;
}

/** Null on the server: no highlight is rendered until the client knows the time. */
function getServerSnapshot(): Date | null {
  return null;
}

function subscribeToMinute(onChange: () => void): () => void {
  // Every 15s rather than 60s so the highlight lands within a quarter-minute
  // of the real boundary; the snapshot cache makes the extra reads free.
  const id = setInterval(onChange, 15_000);
  return () => clearInterval(id);
}

export function WeeklyTimetable({
  blocks,
  courses,
}: {
  blocks: TimetableBlock[];
  courses: TimetableCourse[];
}) {
  // Ticks each minute so "in 25 min" stays true and the current-class
  // highlight moves without a reload. useSyncExternalStore rather than
  // useState-in-an-effect: the clock genuinely IS external state, the server
  // snapshot is null so SSR renders no highlight and hydration cannot
  // mismatch, and it does not trip the React Compiler's set-state-in-effect
  // rule the way the effect version does.
  const now = useSyncExternalStore(subscribeToMinute, getMinuteSnapshot, getServerSnapshot);

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const days = byDay(blocks);
  const { startHour, endHour } = gridRange(blocks);
  const totalMinutes = (endHour - startHour) * 60;

  // Null until the client has mounted: rendering a "current class" during SSR
  // would hydrate against a different minute and flash the wrong highlight.
  const context = now ? nowContext(now) : null;
  const current = context ? currentBlock(blocks, context) : null;
  const next = context ? nextClass(blocks, context) : null;

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  return (
    <div className="space-y-4">
      {context ? (
        <div className="flex flex-wrap gap-3">
          <StatusPill
            tone={current ? "live" : "idle"}
            label={current ? "In class now" : "No class right now"}
            detail={
              current
                ? `${courseById.get(current.course_id)?.code ?? "Class"} · until ${formatTime(current.end_time)}`
                : undefined
            }
          />
          {next ? (
            <StatusPill
              tone="next"
              label={`Next · ${describeUntil(next.minutesUntil)}`}
              detail={`${courseById.get(next.block.course_id)?.code ?? "Class"} · ${DAY_LABELS[next.block.day_of_week]} ${formatTime(next.block.start_time)}${next.block.room ? ` · ${next.block.room}` : ""}`}
            />
          ) : null}
        </div>
      ) : null}

      {/* Horizontal scroll on narrow screens rather than squeezing seven
          columns into a phone — a 40px-wide Wednesday is unreadable. */}
      <div className="overflow-x-auto">
        <div className="flex min-w-[52rem] gap-px rounded-lg border border-border bg-border">
          {/* Hour gutter */}
          <div className="w-14 shrink-0 bg-card">
            <div className="h-9 border-b border-border" />
            <div className="relative" style={{ height: totalMinutes }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-1 -translate-y-1/2 text-right text-caption tabular-nums text-muted-foreground/70"
                  style={{ top: (hour - startHour) * 60 }}
                >
                  {formatTime(`${String(hour).padStart(2, "0")}:00`)}
                </div>
              ))}
            </div>
          </div>

          {days.map((day) => {
            const isToday = context?.dayOfWeek === day.dayOfWeek;
            return (
              <div key={day.dayOfWeek} className="min-w-0 flex-1 bg-card">
                <div
                  className={cn(
                    "flex h-9 items-center justify-center border-b border-border text-label",
                    isToday ? "bg-brand/10 font-semibold text-brand" : "text-muted-foreground",
                  )}
                >
                  {day.label}
                </div>

                <div className="relative" style={{ height: totalMinutes }}>
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute inset-x-0 border-t border-border/40"
                      style={{ top: (hour - startHour) * 60 }}
                    />
                  ))}

                  {/* Where "now" falls, on today's column only. */}
                  {isToday && context ? (
                    <div
                      className="absolute inset-x-0 z-20 border-t-2 border-danger"
                      style={{ top: context.minutes - startHour * 60 }}
                      aria-hidden
                    />
                  ) : null}

                  {day.blocks.map((block) => {
                    const start = toMinutes(block.start_time);
                    const end = toMinutes(block.end_time);
                    if (start === null || end === null) return null;
                    const course = courseById.get(block.course_id);
                    const isCurrent = current?.id === block.id;
                    const isNext = !isCurrent && next?.block.id === block.id;
                    return (
                      <div
                        key={block.id}
                        className={cn(
                          "absolute inset-x-1 z-10 overflow-hidden rounded-md border px-1.5 py-1",
                          isCurrent
                            ? "border-brand bg-brand/20 ring-1 ring-brand"
                            : isNext
                              ? "border-brand/40 bg-brand/10"
                              : "border-border bg-muted/40",
                        )}
                        style={{
                          top: start - startHour * 60,
                          // Floor of 22px so a 30-minute tutorial still shows
                          // its course code rather than collapsing to a sliver.
                          height: Math.max(22, end - start),
                        }}
                        title={`${course?.name ?? "Class"} · ${formatTime(block.start_time)}–${formatTime(block.end_time)}${block.room ? ` · ${block.room}` : ""}`}
                      >
                        <p className="truncate text-caption font-semibold leading-tight">
                          {course?.code ?? "Class"}
                        </p>
                        {end - start >= 45 ? (
                          <p className="truncate text-caption leading-tight text-muted-foreground">
                            {block.room ?? block.type}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {blocks.length === 0 ? (
        <p className="text-body text-muted-foreground">
          No class times recorded yet. Add schedule blocks to a course and the week fills in here.
        </p>
      ) : null}
    </div>
  );
}

function StatusPill({
  tone,
  label,
  detail,
}: {
  tone: "live" | "next" | "idle";
  label: string;
  detail?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2",
        tone === "live" ? "border-brand/40 bg-brand/10" : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "live" ? "animate-pulse bg-brand" : tone === "next" ? "bg-brand/50" : "bg-muted-foreground/40",
        )}
      />
      <div className="min-w-0">
        <p className="text-label font-medium">{label}</p>
        {detail ? <p className="truncate text-caption text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}
