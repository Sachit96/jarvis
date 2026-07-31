import { cn } from "@/lib/utils";
import { MEMORY_TYPE_LABEL, MEMORY_TYPE_BADGE_CLASS, type MemoryType } from "@/lib/validations/memory";

export function MemoryTypeBadge({ type, className }: { type: MemoryType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        MEMORY_TYPE_BADGE_CLASS[type],
        className,
      )}
    >
      {MEMORY_TYPE_LABEL[type]}
    </span>
  );
}
