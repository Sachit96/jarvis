import Link from "next/link";
import { Sparkles, Circle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { MentorBriefSections } from "@/components/mentor/mentor-brief-sections";

export function MentorInsightCard({
  markdownBody,
  focusAreas,
  compact = false,
  fill = false,
  className,
}: {
  markdownBody: string | null;
  focusAreas: string[];
  compact?: boolean;
  /** Marks this instance as its column's filler. Unlike a metric list, the "no brief yet"
   *  empty state centers gracefully in whatever space is left — see RecentActivityCard for
   *  the same pattern. */
  fill?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("ring-brand/25", compact && "min-h-[120px]", className)} padding={compact ? "compact" : "default"}>
      <header className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">AI Mentor Insight</p>
        </div>
        <Link
          href="/mentor"
          className="flex shrink-0 items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-caption font-medium text-brand transition-colors hover:bg-brand/25"
        >
          Ask AI
        </Link>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        {markdownBody ? (
          <>
            <MentorBriefSections markdownBody={markdownBody} compact maxSections={1} />
            {!compact && focusAreas.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {focusAreas.map((area, i) => (
                  <li key={i} className="flex items-center gap-2 text-body text-foreground">
                    <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                    {area}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : fill ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
            <p className="max-w-[280px] text-[13px] text-muted-foreground">No brief yet today — ask your mentor to have a look.</p>
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">No brief yet today — ask your mentor to have a look.</p>
        )}
        <Link
          href="/mentor"
          className={cn("inline-flex items-center gap-1 pt-3 text-[13px] font-medium text-brand hover:underline", fill && "mt-auto")}
        >
          View Full Brief
          <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
        </Link>
      </div>
    </Card>
  );
}
