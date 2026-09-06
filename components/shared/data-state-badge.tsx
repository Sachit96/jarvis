import { cn } from "@/lib/utils";
import { DATA_STATE_META, type DataState } from "@/lib/data-state";

/**
 * Standalone status badge — icon + label, for Settings integration cards
 * ("status, last sync, failure state, one clear action" per the audit).
 * StatTile has its own built-in `note`/`unmeasured` props for the inline
 * case (a qualifying footnote under a dashboard number) — this is the
 * freestanding version for places with no tile to attach to.
 */
export function DataStateBadge({ state, label, className }: { state: DataState; label?: string; className?: string }) {
  const meta = DATA_STATE_META[state];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", meta.className, className)}>
      <Icon className="h-4 w-4" />
      {label ?? meta.label}
    </span>
  );
}
