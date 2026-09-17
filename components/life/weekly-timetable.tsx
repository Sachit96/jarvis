"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  byDay,
  gridRange,
  formatTime,
  toMinutes,
  nowContext,
  currentBlock,
  nextBlock,
  describeUntil,
  DAY_LABELS,
} from "@/lib/life/timetable";
import type { WeekBlock } from "@/lib/db/queries/life-schedule";

/**
 * The week at a glance for the Life OS Timetable: the standing personal
 * routine (self-care, commute, On Radar work, gym, meals, personal time)
 * merged with class times pulled in from University, all in one grid.
 *
 * Same absolute-positioned-column approach as
 * components/uni/weekly-timetable.tsx — a block is a time range, not a
 * table cell — generalized here to color/label by `category` instead of by
 * course, since there's no course palette to key off of.
 */

const CATEGORY_LABEL: Record<string, string> = {
  self_care: "Self-care",
  commute: "Commute",
  deep_work: "On Radar",
  gym: "Gym",
  meal: "Meal",
  personal: "Personal",
  class: "Class",
};

const CATEGORY_STYLE: Record<string, string> = {
  self_care: "border-sky-400/40 bg-sky-400/10",
  commute: "border-slate-400/40 bg-slate-400/10",
  deep_work: "border-violet-400/40 bg-violet-400/10",
  gym: "border-orange-400/40 bg-orange-400/10",
  meal: "border-amber-400/40 bg-amber-400/10",
  personal: "border-emerald-400/40 bg-emerald-400/10",
  class: "border-brand/40 bg-brand/10",
};

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
  const id = setInterval(onChange, 15_000);
  return () => clearInterval(id);
}

export function LifeWeeklyTimetable({ blocks }: { blocks: WeekBlock[] }) {
  // See components/uni/weekly-timetable.tsx for why useSyncExternalStore
  // rather than useState-in-an-effect: the clock is genuinely external
  // state, and a null server snapshot means SSR renders no highlight, so
  // hydration can't mismatch.
  const now = useSyncExternalStore(subscribeToMinute, getMinuteSnapshot, getServerSnapshot);

  const days = byDay(blocks);
  const { startHour, endHour } = gridRange(blocks);
  const totalMinutes = (endHour - startHour) * 60;

  const context = now ? nowContext(now) : null;
  const current = context ? currentBlock(blocks, context) : null;
  const next = context ? nextBlock(blocks, context) : null;

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  return (
    <div className="space-y-4">
      {context ? (
        <div className="flex flex-wrap gap-3">
          <StatusPill
            tone={current ? "live" : "idle"}
            label={current ? (CATEGORY_LABEL[current.category] ?? current.label) : "Free right now"}
            detail={current ? `${current.label} · until ${formatTime(current.end_time)}` : undefined}
          />
          {next ? (
            <StatusPill
              tone="next"
              label={`Next · ${describeUntil(next.minutesUntil)}`}
              detail={`${next.block.label} · ${DAY_LABELS[next.block.day_of_week]} ${formatTime(next.block.start_time)}${next.block.detail ? ` · ${next.block.detail}` : ""}`}
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
                    const isCurrent = current?.id === block.id;
                    const isNext = !isCurrent && next?.block.id === block.id;
                    const categoryStyle = CATEGORY_STYLE[block.category] ?? "border-border bg-muted/40";
                    return (
                      <div
                        key={block.id}
                        className={cn(
                          "absolute inset-x-1 z-10 overflow-hidden rounded-md border px-1.5 py-1",
                          isCurrent ? cn(categoryStyle, "ring-1 ring-brand") : isNext ? "border-brand/40 bg-brand/10" : categoryStyle,
                        )}
                        style={{
                          top: start - startHour * 60,
                          // Floor of 22px so a 30-minute block still shows its
                          // label rather than collapsing to a sliver.
                          height: Math.max(22, end - start),
                        }}
                        title={`${block.label} · ${formatTime(block.start_time)}–${formatTime(block.end_time)}${block.detail ? ` · ${block.detail}` : ""}`}
                      >
                        <p className="truncate text-caption font-semibold leading-tight">{block.label}</p>
                        {end - start >= 45 ? (
                          <p className="truncate text-caption leading-tight text-muted-foreground">
                            {block.detail ?? CATEGORY_LABEL[block.category] ?? block.category}
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
          No blocks yet. Add your routine below, and class times you add under University will show up here too.
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
