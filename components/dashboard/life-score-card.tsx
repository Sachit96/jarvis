import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CATEGORY_HEX, CATEGORY_LABEL, type Category } from "@/lib/category-colors";
import type { LifeScoreSnapshot } from "@/lib/db/queries/life-score";

const CATEGORY_ORDER: Exclude<Category, "money">[] = ["business", "health", "finance", "goals", "habits"];
const RING_SIZE = 96;
const RING_STROKE = 10;

/**
 * Composite score across all five modules, shown as a gradient donut with a
 * per-category legend. Every number here comes from getLifeScoreSnapshot —
 * see that function's doc comment for exactly how each category is
 * computed from real rows (nothing here is estimated or invented).
 *
 * Fixed height (168px) — this card never needs to absorb column overflow,
 * it's a deliberately small, dense readout next to taller neighbors.
 */
export function LifeScoreCard({ score, compact = false, className }: { score: LifeScoreSnapshot; compact?: boolean; className?: string }) {
  const size = RING_SIZE;
  const strokeWidth = RING_STROKE;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score.overall)) / 100);
  const segmentCount = 60;
  const segmentGap = circumference / segmentCount;
  const gradientId = "lifeScoreGradient";

  const ring = (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="55%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
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
          stroke={`url(#${gradientId})`}
          className="fill-none transition-[stroke-dashoffset] duration-500 ease-[var(--ease-jarvis)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-body font-bold text-foreground">{score.overall}</span>
        <span className="text-caption text-muted-foreground">/100</span>
      </div>
    </div>
  );

  return (
    <Card padding={compact ? "compact" : "default"} className={cn("h-[168px]", className)}>
      <header className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Life Score</p>
      </header>
      <div className="flex min-h-0 flex-1 items-center gap-4">
        {ring}
        <ul className="flex-1 space-y-2">
          {CATEGORY_ORDER.map((cat) => (
            <li key={cat} className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_HEX[cat] }} />
                {CATEGORY_LABEL[cat]}
              </span>
              <span className="font-mono tabular-nums text-foreground">{score[cat]}</span>
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
