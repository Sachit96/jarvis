"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { deletePrayerAction, togglePrayerTodayAction } from "@/actions/life-actions";
import type { Database } from "@/lib/supabase/database.types";

type Prayer = Database["public"]["Tables"]["prayers"]["Row"];

export function PrayerChecklist({
  prayers,
  completedIds,
}: {
  prayers: Prayer[];
  completedIds: string[];
}) {
  const [done, setDone] = useState<Set<string>>(() => new Set(completedIds));
  const [isPending, startTransition] = useTransition();

  const remaining = prayers.filter((p) => !done.has(p.id)).length;

  function handleToggle(prayerId: string, checked: boolean) {
    const next = new Set(done);
    if (checked) next.add(prayerId);
    else next.delete(prayerId);
    setDone(next); // instant UI feedback

    startTransition(async () => {
      try {
        await togglePrayerTodayAction(prayerId, checked);
      } catch {
        setDone(done); // revert
      }
    });
  }

  function handleDelete(prayerId: string) {
    startTransition(() => deletePrayerAction(prayerId));
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-lg border p-3 text-sm",
          remaining === 0
            ? "border-success/40 bg-success/10 text-success"
            : "border-warn/40 bg-warn/10 text-warn",
        )}
      >
        {remaining === 0
          ? "All prayers logged for today."
          : `${remaining} prayer${remaining === 1 ? "" : "s"} remaining today.`}
      </div>

      <ul className="space-y-2">
        {prayers.map((prayer) => {
          const checked = done.has(prayer.id);
          return (
            <li
              key={prayer.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(c) => handleToggle(prayer.id, c === true)}
                aria-label={`Log ${prayer.name}`}
              />
              <span className={cn("flex-1 text-sm", checked && "text-muted-foreground line-through")}>
                {prayer.name}
              </span>
              <button
                onClick={() => handleDelete(prayer.id)}
                aria-label={`Delete ${prayer.name}`}
                className="text-muted-foreground hover:text-danger"
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
