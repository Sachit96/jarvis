import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The small circular icon that sits at the head of a list row.
 *
 * Consolidated from four hand-rolled versions that each pulled a colour out
 * of the category palette (`CATEGORY_BADGE_CLASS`). In a list where every
 * row already carries its own label and its own domain icon, the tint was
 * repeating information the row had already given — and a feed of six rows
 * in six hues is the single loudest thing on a dashboard.
 *
 * Colour is now reserved for `tone="brand"`, i.e. the rows that are actually
 * distinguished. That is what the category palette is still for elsewhere:
 * charts, where the colour is the only thing carrying the series identity.
 */
export function IconChip({
  icon: Icon,
  tone = "neutral",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: "neutral" | "brand" | "danger" | "success";
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "sm" ? "size-6" : "size-7",
        tone === "brand" && "bg-[color-mix(in_oklab,var(--brand)_26%,transparent)] text-white",
        tone === "danger" && "bg-danger/15 text-danger",
        tone === "success" && "bg-success/15 text-success",
        tone === "neutral" && "bg-white/[0.05] text-foreground-tertiary",
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={2} />
    </span>
  );
}
