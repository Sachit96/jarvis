"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarItem {
  id: string;
  title: string;
  due_at: string;
  color: string;
  sublabel?: string;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Local calendar date, NOT toISOString().slice(0, 10) — found live testing
 * the new class-occurrence wiring (2026-09-04, evening): weekDays below is
 * built by copying `now`'s full timestamp (via `new Date(startOfWeek)`)
 * and only changing the day-of-month, so each entry keeps *today's actual
 * time-of-day*, not midnight. Past ~8pm in a UTC-negative zone (EDT is
 * UTC-4), that local time-of-day plus the UTC offset rolls past midnight,
 * so toISOString() silently returns the NEXT calendar date — every item
 * in week view was landing one day off from its real label whenever this
 * ran in the evening. Month view's day CELLS were unaffected (each is
 * built via new Date(year, month, day), local midnight already) — but
 * its "is this today" highlight uses dayKey(now) too, the same as week/
 * day view's todayKey, so the highlighted cell was also off by one in
 * the evening even though the grid itself was correct. Building the key
 * from local getFullYear/getMonth/getDate instead is correct regardless
 * of the Date's time-of-day.
 */
function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Combined assessments + deadlines calendar. Month view is a hand-rolled
 * grid (same pattern as components/health/workout-calendar.tsx, which
 * already diverged from the react-day-picker wrapper for this exact
 * "grid + per-day data overlay" shape); week/day are simple chronological
 * lists rather than a full react-big-calendar-style grid — drag-and-drop
 * and week/day date navigation are both explicitly out of scope tonight.
 */
export function UniCalendar({ items }: { items: CalendarItem[] }) {
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [monthOffset, setMonthOffset] = useState(0);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = dayKey(new Date(item.due_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  const now = new Date();
  const viewMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = new Date(year, month, 1).getDay();
  const todayKey = dayKey(now);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1">
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                view === v ? "bg-brand text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
        {view === "month" ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setMonthOffset((o) => o - 1)} className="rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="w-32 text-center text-sm font-medium text-foreground">{monthLabel}</p>
            <button onClick={() => setMonthOffset((o) => o + 1)} className="rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {view === "month" ? (
        <div className="mt-4 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={i} className="text-center font-mono text-[10px] text-muted-foreground/60">
              {label}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const key = dayKey(new Date(year, month, day));
            const dayItems = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-[64px] flex-col gap-1 rounded-md p-1.5",
                  isToday ? "bg-brand/10 ring-1 ring-brand" : "bg-white/[0.03]",
                )}
              >
                <span className={cn("font-mono text-[11px]", isToday ? "text-brand" : "text-muted-foreground")}>{day}</span>
                <div className="flex flex-wrap gap-0.5">
                  {dayItems.slice(0, 4).map((item) => (
                    <span key={item.id} title={item.title} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                  ))}
                  {dayItems.length > 4 ? <span className="text-[9px] text-muted-foreground">+{dayItems.length - 4}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {view === "week" ? (
        <div className="mt-4 space-y-2">
          {weekDays.map((d) => {
            const key = dayKey(d);
            const dayItems = (byDay.get(key) ?? []).sort((a, b) => a.due_at.localeCompare(b.due_at));
            const isToday = key === todayKey;
            return (
              <div key={key} className={cn("rounded-xl p-3", isToday ? "bg-brand/10 ring-1 ring-brand" : "bg-white/[0.03]")}>
                <p className="text-xs font-medium text-muted-foreground">{d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
                {dayItems.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground/50">Nothing due</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {dayItems.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-sm">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-foreground">{item.title}</span>
                        {item.sublabel ? <span className="text-caption text-muted-foreground">{item.sublabel}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {view === "day" ? (
        <div className="mt-4 rounded-xl bg-white/[0.03] p-3">
          <p className="text-xs font-medium text-muted-foreground">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          {(byDay.get(todayKey) ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground/50">Nothing due today</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {(byDay.get(todayKey) ?? [])
                .sort((a, b) => a.due_at.localeCompare(b.due_at))
                .map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-foreground">{item.title}</span>
                    {item.sublabel ? <span className="text-caption text-muted-foreground">{item.sublabel}</span> : null}
                  </li>
                ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
