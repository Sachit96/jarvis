"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The search drawer, top-left.
 *
 * Filters the graph rather than navigating: matches stay lit and everything
 * else dims, so you can see where a concept sits in relation to the rest of
 * the brain. Hiding non-matches would take their edges with them and the
 * graph would appear to restructure itself as you type.
 */
export function BrainSearch({
  value,
  onChange,
  categories,
  matchCount,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  categories: { id: string; label: string; count: number; color: string }[];
  /** Nodes currently lit, so an empty search says something useful. */
  matchCount: number;
  className?: string;
}) {
  return (
    <div className={cn("w-64 rounded-[var(--radius)] border border-white/10 bg-black/40 p-3 backdrop-blur-md", className)}>
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 focus-within:border-brand/50">
        <Search className="size-3.5 shrink-0 text-white/40" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search the brain…"
          aria-label="Search the knowledge graph"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-white/35 focus:ring-0 focus:outline-none"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="shrink-0 text-white/40 transition-colors hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {value ? (
        <p className="mt-2 px-1 text-[10px] tracking-[0.14em] text-white/40 uppercase">
          {matchCount === 0 ? "No matches" : `${matchCount} lit`}
        </p>
      ) : null}

      {categories.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {categories.slice(0, 7).map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-[11px] text-white/55">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: c.color, boxShadow: `0 0 6px ${c.color}` }}
              />
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              <span className="tabular shrink-0 text-white/35">{c.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 px-1 text-[11px] leading-relaxed text-white/40">
          Nothing in memory yet. Entries you save appear here as a cluster.
        </p>
      )}
    </div>
  );
}
