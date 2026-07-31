"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { MemoryHeader } from "@/components/memory/memory-header";
import { MemoryFilterRail } from "@/components/memory/memory-filter-rail";
import { MemoryCard } from "@/components/memory/memory-card";
import { MemoryDrawer } from "@/components/memory/memory-drawer";
import { MemoryTimelineView } from "@/components/memory/memory-timeline-view";
import { AddMemoryForm } from "@/components/memory/add-memory-form";
import { computeMemoryStats, type MemoryEntry } from "@/lib/db/queries/memory";
import { MEMORY_TYPE_LABEL, type MemoryType } from "@/lib/validations/memory";

export function MemoryPageClient({ entries }: { entries: MemoryEntry[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  const view = searchParams.get("view") === "timeline" ? "timeline" : "library";
  const activeType = searchParams.get("type") as MemoryType | null;
  const activeTag = searchParams.get("tag");
  const activeSource = searchParams.get("source");
  const activePinned = searchParams.get("pinned") === "1";

  const stats = useMemo(() => computeMemoryStats(entries), [entries]);
  const pinnedCount = useMemo(() => entries.filter((e) => e.pinned).length, [entries]);
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) for (const tag of e.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (activeType && e.type !== activeType) return false;
      if (activeTag && !e.tags.includes(activeTag)) return false;
      if (activeSource && activeSource !== "all" && e.source !== activeSource) return false;
      if (activePinned && !e.pinned) return false;
      return true;
    });
  }, [entries, activeType, activeTag, activeSource, activePinned]);

  const openEntry = openEntryId ? (entries.find((e) => e.id === openEntryId) ?? null) : null;

  function setView(next: "library" | "timeline") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "library") params.delete("view");
    else params.set("view", next);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const anyFilterActive = Boolean(activeType || activeTag || (activeSource && activeSource !== "all") || activePinned);
  const emptyMessage = activePinned
    ? "No pinned memories yet. Pin the ones JARVIS should always weigh heavily."
    : activeType
      ? `No ${MEMORY_TYPE_LABEL[activeType].toLowerCase()} entries yet.`
      : "No memories saved yet. Add one below so JARVIS stops guessing how you like things done.";

  return (
    <div className="space-y-4">
      <MemoryHeader stats={stats} />

      <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1 text-body">
        {(["library", "timeline"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-md px-3 py-1 capitalize transition-colors",
              view === v ? "bg-brand/20 text-brand" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        <MemoryFilterRail stats={stats} tagCounts={tagCounts} pinnedCount={pinnedCount} />

        <div className="min-w-0 flex-1 space-y-4">
          <AddMemoryForm />

          {filtered.length === 0 ? (
            <div className="rounded-2xl bg-card ring-1 ring-border">
              <EmptyState
                icon={BrainCircuit}
                title={anyFilterActive ? "Nothing matches this filter" : "No memories yet"}
                description={emptyMessage}
              />
            </div>
          ) : view === "timeline" ? (
            <MemoryTimelineView entries={filtered} onOpen={(e) => setOpenEntryId(e.id)} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((entry) => (
                <MemoryCard key={entry.id} entry={entry} onOpen={() => setOpenEntryId(entry.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <MemoryDrawer key={openEntry?.id ?? "closed"} entry={openEntry} onClose={() => setOpenEntryId(null)} />
    </div>
  );
}
