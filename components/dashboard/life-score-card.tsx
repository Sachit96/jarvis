import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CATEGORY_LABEL, type Category } from "@/lib/category-colors";
import type { LifeScoreSnapshot } from "@/lib/db/queries/life-score";

const CATEGORY_ORDER: Exclude<Category, "money">[] = ["business", "health", "finance", "goals", "habits"];
const RING_SIZE = 96;
const RING_STROKE = 10;

/**
 * Composite score across all five modules, shown as a gradient donut with a
 * per-category readout. Every number here comes from getLifeScoreSnapshot —
 * see that function's doc comment for exactly how each category is
 * computed from real rows (nothing here is estimated or invented).
 *
 * Two visual decisions worth stating:
 *
 * The ring was a teal → blue → violet gradient, hard-coded in hex, left over
 * from the palette before this one. It is the brand gradient now, and it
 * reads from the tokens so it cannot drift again.
 *
 * The legend was five colour dots, one per category. A dot next to its own
 * label communicates nothing the label doesn't, so all it actually did was
 * put five unrelated hues on the command centre. Each row is a thin meter
 * instead: same footprint, but now the colour is carrying the score.
 */
export function LifeScoreCard({
  score,
  compact = false,
  className,
}: {
  score: LifeScoreSnapshot;
  compact?: boolean;
  className?: string;
}) {
  const size = RING_SIZE;
  const strokeWidth = RING_STROKE;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score.overall)) / 100);
  const segmentCount = 60;
  const segmentGap = circumference / segmentCount;
  const gradientId = "lifeScoreGradient";

  const ring = (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brand)" />
            <stop offset="100%" stopColor="var(--brand-2)" />
          </linearGradient>
        </defs>
        {/* Ticked track — the radar motif, at instrument scale. */}
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
          stroke={`url(#${gradientId})`}
          className="fill-none transition-[stroke-dashoffset] duration-500 ease-[var(--ease-jarvis)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-display text-title leading-none text-foreground">{score.overall}</span>
        <span className="mt-1 text-caption text-foreground-tertiary">/100</span>
      </div>
    </div>
  );

  return (
    <Card padding={compact ? "compact" : "default"} className={cn("h-[168px]", className)}>
      <header className="mb-3 flex shrink-0 items-center justify-between">
        <p className="eyebrow">Life Score</p>
      </header>
      <div className="flex min-h-0 flex-1 items-center gap-5">
        {ring}
        <ul className="flex-1 space-y-[7px]">
          {CATEGORY_ORDER.map((cat) => (
            <li key={cat} className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-caption">
              <span className="text-foreground-tertiary">{CATEGORY_LABEL[cat]}</span>
              <span className="tabular font-medium text-foreground">{score[cat]}</span>
              <span className="col-span-2 h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
                <span
                  className="gradient-brand block h-full rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, score[cat]))}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

// No "View Breakdown" link — the legend above already shows every category's
// score, and JARVIS has no dedicated breakdown page to send it to; adding
// one would mean inventing a new route with nothing real behind it.
