"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Flame, Pin, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StreakHeatmap } from "@/components/shared/streak-heatmap";
import { computeStreak } from "@/lib/db/queries/life";
import {
  deleteHabitAction,
  toggleHabitTodayAction,
  toggleHabitPinnedAction,
  moveHabitAction,
} from "@/actions/life-actions";
import type { Database } from "@/lib/supabase/database.types";

type Habit = Database["public"]["Tables"]["habits"]["Row"];

const METRIC_LABEL: Record<string, string> = {
  sleep: "Sleep",
  focus: "Focus",
  training: "Training",
  screen_time: "Screen Time",
  consistency: "Consistency",
  no_g: "No G",
  custom: "Custom",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function HabitCard({
  habit,
  completedDates,
}: {
  habit: Habit;
  completedDates: string[];
}) {
  const [dates, setDates] = useState<Set<string>>(() => new Set(completedDates));
  const [pinned, setPinned] = useState(habit.pinned);
  const [isPending, startTransition] = useTransition();

  const today = todayStr();
  const completedToday = dates.has(today);
  const { current, best } = useMemo(() => computeStreak(dates), [dates]);

  function handleToggle(checked: boolean) {
    const next = new Set(dates);
    if (checked) next.add(today);
    else next.delete(today);
    setDates(next); // instant UI feedback

    startTransition(async () => {
      try {
        await toggleHabitTodayAction(habit.id, checked);
      } catch {
        setDates(dates); // revert
      }
    });
  }

  function handleTogglePin() {
    const next = !pinned;
    setPinned(next);
    startTransition(async () => {
      try {
        await toggleHabitPinnedAction(habit.id, next);
      } catch {
        setPinned(!next);
      }
    });
  }

  function handleMove(direction: "up" | "down") {
    startTransition(() => moveHabitAction(habit.id, direction));
  }

  function handleDelete() {
    startTransition(() => deleteHabitAction(habit.id));
  }

  const isNoG = habit.metric_type === "no_g";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-opacity",
        isNoG ? "border-brand/50" : "border-border",
        isPending && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{habit.name}</p>
            <Badge variant="outline" className="text-[10px] uppercase">
              {METRIC_LABEL[habit.metric_type] ?? habit.metric_type}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-3 font-mono text-xs text-muted-foreground">
            <span className="flex items-center gap-1 text-brand">
              <Flame className="h-3.5 w-3.5" /> {current} day{current === 1 ? "" : "s"}
            </span>
            <span>best {best}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Checkbox
            checked={completedToday}
            onCheckedChange={(c) => handleToggle(c === true)}
            aria-label={`Log ${habit.name} for today`}
          />
          <button
            onClick={handleTogglePin}
            aria-label={pinned ? "Unpin" : "Pin to top"}
            className={cn("hover:text-foreground", pinned ? "text-brand" : "text-muted-foreground")}
          >
            <Pin className="h-3.5 w-3.5" fill={pinned ? "currentColor" : "none"} />
          </button>
          <div className="flex flex-col">
            <button onClick={() => handleMove("up")} aria-label="Move up" className="text-muted-foreground hover:text-foreground">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => handleMove("down")} aria-label="Move down" className="text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <button onClick={handleDelete} aria-label="Delete habit" className="text-muted-foreground hover:text-danger">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <StreakHeatmap completedDates={dates} />
      </div>
    </div>
  );
}
