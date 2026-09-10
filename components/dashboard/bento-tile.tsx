import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One cell of the Home bento.
 *
 * Fills its grid cell rather than sizing to content, because the whole point
 * of a fixed-viewport dashboard is that the grid decides the layout and the
 * content fits inside it. Anything that could grow past its cell clips —
 * `min-h-0` plus `overflow-hidden` — so one long value can never push the
 * page into a scrollbar.
 */
export function BentoTile({
  label,
  value,
  hint,
  icon: Icon,
  href,
  accent = false,
  children,
  className,
}: {
  label: string;
  /** Pre-formatted. This component never formats a number. */
  value?: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  /** Makes the whole tile a link into the module the figure came from. */
  href?: string;
  /** The one tile per screen that carries brand light. */
  accent?: boolean;
  children?: ReactNode;
  /**
   * Grid placement — `col-span-2` and friends.
   *
   * Applied to the OUTERMOST element, which is the `<Link>` when `href` is
   * set. Putting it on the inner surface instead silently does nothing: the
   * grid item is the link, so the span never reaches the grid and the tile
   * renders one column wide. Which is exactly what it did.
   */
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        accent ? "surface-lit" : "surface",
        href && "surface-interactive",
        "flex h-full min-h-0 flex-col overflow-hidden p-4",
        // No `className` here — see the prop's note.
      )}
    >
      <div className="flex shrink-0 items-center gap-2">
        {Icon ? (
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-md",
              accent
                ? "bg-[color-mix(in_oklab,var(--brand)_30%,transparent)] text-white"
                : "bg-white/[0.05] text-foreground-tertiary",
            )}
          >
            <Icon className="size-3" strokeWidth={2} />
          </span>
        ) : null}
        <p className="eyebrow line-clamp-2">{label}</p>
      </div>

      {value !== undefined ? (
        <p className="tabular mt-2 shrink-0 truncate font-display text-[1.375rem] leading-none font-semibold tracking-[-0.02em] text-foreground sm:text-metric">
          {value}
        </p>
      ) : null}
      {hint ? <p className="mt-1 shrink-0 truncate text-caption text-foreground-tertiary">{hint}</p> : null}

      {children ? <div className="mt-2 min-h-0 flex-1 overflow-hidden">{children}</div> : null}
    </div>
  );

  if (!href) return <div className={cn("min-h-0", className)}>{body}</div>;
  return (
    <Link
      href={href}
      className={cn(
        "block min-h-0 rounded-[var(--radius)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {body}
    </Link>
  );
}
