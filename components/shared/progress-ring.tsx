interface ProgressRingProps {
  /** 0-100 */
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  /** Tailwind stroke-color class for the progress arc. */
  colorClassName?: string;
}

/** A single circular progress ring — used for goal completion and the Today's Routine summary. */
export function ProgressRing({
  percent,
  size = 96,
  strokeWidth = 8,
  label,
  sublabel,
  colorClassName = "stroke-brand",
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
          className={`fill-none transition-[stroke-dashoffset] duration-500 ease-[var(--ease-jarvis)] ${colorClassName}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-heading font-semibold text-foreground">{label ?? `${Math.round(clamped)}%`}</span>
        {sublabel ? <span className="text-caption text-muted-foreground">{sublabel}</span> : null}
      </div>
    </div>
  );
}
