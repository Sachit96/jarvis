interface ProgressRingProps {
  /** 0-100 */
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  /**
   * Tailwind stroke-color class for the progress arc. Leave unset for the
   * brand gradient, which is what a ring should normally be — pass a class
   * only when the arc's colour is carrying real state (attendance above or
   * below its threshold, say).
   */
  colorClassName?: string;
}

/**
 * One shared id for every ring's gradient.
 *
 * NOT a per-instance counter: this component renders inside server
 * components, so a module-scoped counter produces different ids on the
 * server and on the client and React tears the tree down on hydration. And
 * not `useId` either, for the same reason — it is a hook.
 *
 * Sharing is safe because the definition is identical everywhere and SVG
 * gradients default to `objectBoundingBox` units, so the same definition
 * resolves against each ring's own box.
 */
const RING_GRADIENT_ID = "jarvis-ring-gradient";

/** A single circular progress ring — used for goal completion and the Today's Routine summary. */
export function ProgressRing({
  percent,
  size = 96,
  strokeWidth = 8,
  label,
  sublabel,
  colorClassName,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  // Segmented/dashed background track (vs. the solid progress arc below) —
  // ~60 short ticks around the ring, purely decorative.
  const segmentCount = 60;
  const segmentGap = circumference / segmentCount;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={RING_GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brand)" />
            <stop offset="100%" stopColor="var(--brand-2)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth * 0.55}
          strokeDasharray={`${segmentGap * 0.55} ${segmentGap * 0.45}`}
          className="fill-none stroke-white/[0.08]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke={colorClassName ? undefined : `url(#${RING_GRADIENT_ID})`}
          className={`fill-none transition-[stroke-dashoffset] duration-500 ease-[var(--ease-jarvis)] ${colorClassName ?? ""}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-heading font-semibold text-foreground">{label ?? `${Math.round(clamped)}%`}</span>
        {sublabel ? <span className="text-caption text-foreground-tertiary">{sublabel}</span> : null}
      </div>
    </div>
  );
}
