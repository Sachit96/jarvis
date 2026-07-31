"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MEMORY_TYPES, MEMORY_TYPE_LABEL, type MemoryType } from "@/lib/validations/memory";
import type { MemoryStats } from "@/lib/db/queries/memory";

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "manual", label: "Manual" },
  { value: "captured", label: "Auto-captured" },
];

export function MemoryFilterRail({
  stats,
  tagCounts,
  pinnedCount,
}: {
  stats: MemoryStats;
  tagCounts: { tag: string; count: number }[];
  pinnedCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeType = searchParams.get("type");
  const activeTag = searchParams.get("tag");
  const activeSource = searchParams.get("source") ?? "all";
  const activePinned = searchParams.get("pinned") === "1";

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleType(type: MemoryType) {
    setParam("type", activeType === type ? null : type);
  }

  function toggleTag(tag: string) {
    setParam("tag", activeTag === tag ? null : tag);
  }

  return (
    <div className="w-[200px] shrink-0 space-y-5">
      <div>
        <p className="mb-1.5 text-label uppercase tracking-wide text-muted-foreground">Type</p>
        <ul className="space-y-0.5">
          {MEMORY_TYPES.map((type) => (
            <li key={type}>
              <button
                onClick={() => toggleType(type)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-body transition-colors",
                  activeType === type ? "bg-brand/15 text-brand" : "text-foreground hover:bg-white/[0.04]",
                )}
              >
                <span>{MEMORY_TYPE_LABEL[type]}</span>
                <span className="font-mono text-caption text-muted-foreground">{stats.byType[type]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <button
          onClick={() => setParam("pinned", activePinned ? null : "1")}
          className={cn(
            "flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-body transition-colors",
            activePinned ? "bg-brand/15 text-brand" : "text-foreground hover:bg-white/[0.04]",
          )}
        >
          <span>Pinned</span>
          <span className="font-mono text-caption text-muted-foreground">{pinnedCount}</span>
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-label uppercase tracking-wide text-muted-foreground">Source</p>
        <div className="flex flex-col gap-0.5">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setParam("source", opt.value === "all" ? null : opt.value)}
              className={cn(
                "rounded-md px-2 py-1 text-left text-body transition-colors",
                activeSource === opt.value ? "bg-brand/15 text-brand" : "text-foreground hover:bg-white/[0.04]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {tagCounts.length > 0 ? (
        <div>
          <p className="mb-1.5 text-label uppercase tracking-wide text-muted-foreground">Tags</p>
          <ul className="space-y-0.5">
            {tagCounts.map(({ tag, count }) => (
              <li key={tag}>
                <button
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-body transition-colors",
                    activeTag === tag ? "bg-brand/15 text-brand" : "text-foreground hover:bg-white/[0.04]",
                  )}
                >
                  <span className="min-w-0 truncate">{tag}</span>
                  <span className="font-mono text-caption text-muted-foreground">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
