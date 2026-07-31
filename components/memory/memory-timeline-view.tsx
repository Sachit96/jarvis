"use client";

import { bodyPreview } from "@/lib/mentor-format";
import { MemoryTypeBadge } from "@/components/memory/memory-type-badge";
import type { MemoryEntry } from "@/lib/db/queries/memory";
import type { MemoryType } from "@/lib/validations/memory";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diffDays = Math.round((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function MemoryTimelineView({ entries, onOpen }: { entries: MemoryEntry[]; onOpen: (entry: MemoryEntry) => void }) {
  const byDay = new Map<string, MemoryEntry[]>();
  for (const e of entries) {
    const key = e.updated_at.slice(0, 10);
    const list = byDay.get(key) ?? [];
    list.push(e);
    byDay.set(key, list);
  }
  const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a));

  if (days.length === 0) return null;

  return (
    <div className="space-y-6">
      {days.map((day) => (
        <div key={day}>
          <p className="mb-2 text-label uppercase tracking-wide text-muted-foreground">{dayLabel(byDay.get(day)![0].updated_at)}</p>
          <ul className="space-y-2">
            {byDay.get(day)!.map((entry) => (
              <li key={entry.id}>
                <button
                  onClick={() => onOpen(entry)}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <MemoryTypeBadge type={entry.type as MemoryType} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{entry.title}</p>
                    <p className="truncate text-caption text-muted-foreground">{bodyPreview(entry.body, entry.title)}</p>
                  </div>
                  <span className="shrink-0 font-mono text-caption text-muted-foreground">
                    {new Date(entry.updated_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
