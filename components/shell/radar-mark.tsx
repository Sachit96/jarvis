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
 *
 * Stroke width scales inversely with `size` rather than being fixed. The
 * viewBox is 100 units, so a hard-coded 0.75 renders as 0.72px at 96px and
 * 0.24px at 32px — below what a display can draw. As the sidebar lockup the
 * mark was, in practice, a blank square with a dot in it.
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
  // Target a ~0.9px rendered hairline at any size, floored so the mark never
  // becomes a smudge when used very small.
  const stroke = Math.max(0.75, (0.9 * 100) / size);
  return (
    <div
      aria-hidden
      className={cn("relative shrink-0", sweep && "radar-sweep", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        {/* Rings fade outward so the mark reads as depth rather than a target
            sticker — the outermost is barely there. */}
        <circle cx="50" cy="50" r="46" className="fill-none stroke-white/[0.07]" strokeWidth={stroke} />
        <circle cx="50" cy="50" r="32" className="fill-none stroke-white/[0.10]" strokeWidth={stroke} />
        <circle cx="50" cy="50" r="18" className="fill-none stroke-white/[0.14]" strokeWidth={stroke} />
        {/* Crosshair stops short of the centre so the core reads as a point,
            not an intersection. */}
        <line x1="50" y1="4" x2="50" y2="38" className="stroke-white/[0.10]" strokeWidth={stroke} />
        <line x1="50" y1="62" x2="50" y2="96" className="stroke-white/[0.10]" strokeWidth={stroke} />
        <line x1="4" y1="50" x2="38" y2="50" className="stroke-white/[0.10]" strokeWidth={stroke} />
        <line x1="62" y1="50" x2="96" y2="50" className="stroke-white/[0.10]" strokeWidth={stroke} />
        <circle cx="50" cy="50" r="2.5" className="fill-[var(--brand)]" />
        <circle cx="50" cy="50" r="6" className="fill-none stroke-[var(--brand)]/40" strokeWidth={stroke} />
      </svg>
    </div>
  );
}
