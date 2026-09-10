import Link from "next/link";
import { ArrowRight, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { timeAgo } from "@/lib/time";
import { MemoryTypeBadge } from "@/components/memory/memory-type-badge";
import type { MemoryEntry } from "@/lib/db/queries/memory";
import type { MemoryType } from "@/lib/validations/memory";
import { EmptyState } from "@/components/shared/empty-state";

/** Column 1, second card — most recently updated memory entries. */
export function NotesRailCard({ entries, className }: { entries: MemoryEntry[]; className?: string }) {
  const recent = [...entries].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);

  return (
    <Card padding="compact" className={cn("min-h-[240px]", className)}>
      <header className="mb-3 flex shrink-0 items-center justify-between">
        <p className="eyebrow">Recent Notes</p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        {recent.length === 0 ? (
          <EmptyState
            compact
            icon={BrainCircuit}
            title="Nothing remembered"
            description="What you tell JARVIS to remember shows up here."
          />
        ) : (
          <ul className="space-y-2.5">
            {recent.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2">
                <MemoryTypeBadge type={entry.type as MemoryType} className="mt-0.5" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{entry.title}</p>
                  <p className="tabular text-caption text-foreground-tertiary">{timeAgo(entry.updated_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/memory?view=timeline"
          className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] font-medium text-brand hover:underline"
        >
          Full Timeline
          <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
        </Link>
      </div>
    </Card>
  );
}
