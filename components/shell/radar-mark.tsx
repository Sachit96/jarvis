import { cn } from "@/lib/utils";

/**
 * The JARVIS identity mark: concentric rings, a crosshair, and a slow sweep.
 *
 * One implementation reused everywhere rather than a per-page SVG, so the
 * motif becomes recognisable through repetition instead of drifting into
 * five slightly different radars.
 *
 * `sweep` is opt-out because a rotating gradient on a page that already has
 * one is noise — the rule is at most one sweeping radar per view.
 */
export function RadarMark({
  size = 96,
  sweep = true,
  className,
}: {
  size?: number;
  sweep?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("relative shrink-0", sweep && "radar-sweep", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        {/* Rings fade outward so the mark reads as depth rather than a target
            sticker — the outermost is barely there. */}
        <circle cx="50" cy="50" r="46" className="fill-none stroke-white/[0.07]" strokeWidth="0.75" />
        <circle cx="50" cy="50" r="32" className="fill-none stroke-white/[0.10]" strokeWidth="0.75" />
        <circle cx="50" cy="50" r="18" className="fill-none stroke-white/[0.14]" strokeWidth="0.75" />
        {/* Crosshair stops short of the centre so the core reads as a point,
            not an intersection. */}
        <line x1="50" y1="4" x2="50" y2="38" className="stroke-white/[0.10]" strokeWidth="0.75" />
        <line x1="50" y1="62" x2="50" y2="96" className="stroke-white/[0.10]" strokeWidth="0.75" />
        <line x1="4" y1="50" x2="38" y2="50" className="stroke-white/[0.10]" strokeWidth="0.75" />
        <line x1="62" y1="50" x2="96" y2="50" className="stroke-white/[0.10]" strokeWidth="0.75" />
        <circle cx="50" cy="50" r="2.5" className="fill-[var(--brand)]" />
        <circle cx="50" cy="50" r="6" className="fill-none stroke-[var(--brand)]/40" strokeWidth="0.75" />
      </svg>
    </div>
  );
}
