import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Database } from "@/lib/supabase/database.types";

type Goal = Database["public"]["Tables"]["goals"]["Row"];

const MAX_VISIBLE_GOALS = 6;

/**
 * Column 1 filler — absorbs whatever vertical space its column has to spare
 * instead of leaving a void beneath a short list. Capped to the 6
 * nearest-deadline active goals (not the full list) so a busy goals board
 * can't make this the tallest card on the page and drag every other column's
 * height up with it — the rest scrolls internally, "All Goals" pinned below.
 */
export function GoalsRailCard({ goals, className }: { goals: Goal[]; className?: string }) {
  const active = goals
    .filter((g) => g.status !== "achieved")
    .sort((a, b) => (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999"));
  const visible = active.slice(0, MAX_VISIBLE_GOALS);

  return (
    <Card padding="compact" className={cn("min-h-0", className)}>
      <header className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Goals</p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        {active.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No active goals.</p>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visible.map((goal) => (
              <div key={goal.id}>
                {/* line-clamp-2, not truncate (single-line) — found live at
                    768px (Cleanup work order Phase 4): the md-breakpoint
                    2-column layout gives this card a narrower column than
                    either the 390px single-column or the 1440px 2-column
                    layout, and truncate was cutting real goal titles down
                    to a few words ("Week 1 — first client clos…") even
                    though the exact same titles render in full at both
                    narrower and wider viewports. Matches the pattern
                    PriorityTasksWidget already uses for the same reason. */}
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 line-clamp-2 text-[13px] font-medium">{goal.title}</p>
                  <span className="shrink-0 text-right font-mono text-[13px] font-medium tabular-nums text-brand">
                    {goal.progress_percent}%
                  </span>
                </div>
                <Progress value={goal.progress_percent} className="mt-1 h-1" />
              </div>
            ))}
          </div>
        )}
        <Link
          href="/life/goals"
          className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] font-medium text-brand hover:underline"
        >
          All Goals
          <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
        </Link>
      </div>
    </Card>
  );
}
