import { cn } from "@/lib/utils";
import { DATA_STATE_META, type DataState } from "@/lib/data-state";

/**
 * The one status chip in the app: a dot, a word, and nothing else.
 *
 * Consolidated from four hand-rolled versions (`DataStateBadge`, the Hevy
 * sync hint, the operator's online/offline pill, the integration board's
 * row markers), which had drifted into an icon-and-label badge in one
 * place, an 11px grey sentence in another, and a coloured dot in a third —
 * all reporting the same kind of thing.
 *
 * Deliberately a dot rather than an icon. A row of ✓/✗/⊘ glyphs at 14px is
 * harder to scan than a row of coloured dots at a fixed x-position, and the
 * word next to it already says which state it is.
 */
export function StatusBadge({
  state,
  label,
  className,
}: {
  state: DataState;
  /** Overrides the state's default word — for a channel name, say. */
  label?: string;
  className?: string;
}) {
  const meta = DATA_STATE_META[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1",
        "text-[10px] tracking-[0.16em] uppercase",
        meta.className,
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full bg-current",
          state === "connected" && "shadow-[0_0_6px_currentColor]",
        )}
      />
      {label ?? meta.label}
    </span>
  );
}
