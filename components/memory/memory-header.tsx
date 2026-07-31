import { MEMORY_TYPES, MEMORY_TYPE_LABEL } from "@/lib/validations/memory";
import { timeAgo } from "@/lib/time";
import type { MemoryStats } from "@/lib/db/queries/memory";

export function MemoryHeader({ stats }: { stats: MemoryStats }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-card px-4 py-3 ring-1 ring-border">
      <p className="text-body font-medium text-foreground">What JARVIS knows</p>
      <span className="text-body text-muted-foreground">{stats.total} {stats.total === 1 ? "entry" : "entries"}</span>
      <div className="flex flex-wrap gap-1.5">
        {MEMORY_TYPES.filter((t) => stats.byType[t] > 0).map((t) => (
          <span key={t} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-caption text-muted-foreground">
            {MEMORY_TYPE_LABEL[t]} · {stats.byType[t]}
          </span>
        ))}
      </div>
      <span className="ml-auto text-caption text-muted-foreground/70">
        {stats.mostRecentCapture ? `Last captured ${timeAgo(stats.mostRecentCapture)}` : "Nothing auto-captured yet"}
      </span>
    </div>
  );
}
