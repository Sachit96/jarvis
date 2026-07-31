import Link from "next/link";
import { Target, ListChecks, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CATEGORY_BADGE_CLASS, categoryForHref } from "@/lib/category-colors";
import type { UpcomingItem } from "@/lib/db/queries/command-center";

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function UpcomingCard({ items, compact = false, className }: { items: UpcomingItem[]; compact?: boolean; className?: string }) {
  return (
    <Card padding={compact ? "compact" : "default"} className={cn("min-h-[210px]", className)}>
      <header className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Upcoming</p>
        {items.length > 0 ? (
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-caption tabular-nums text-muted-foreground">
            {items.length}
          </span>
        ) : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        {items.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nothing on the horizon — you&apos;re caught up.</p>
        ) : (
          <ul className="-mx-2">
            {items.map((item) => {
              const Icon = item.kind === "task" ? ListChecks : Target;
              const category = categoryForHref(item.href) ?? "habits";
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`flex items-start gap-2.5 rounded-lg px-2 transition-colors hover:bg-white/[0.04] ${compact ? "py-1" : "py-1.5"}`}
                  >
                    <span
                      className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full ${compact ? "h-6 w-6" : "h-7 w-7"} ${CATEGORY_BADGE_CLASS[category]}`}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px]">{item.label}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{formatDate(item.date)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Link
          href="/life/tasks"
          className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] font-medium text-brand hover:underline"
        >
          View Calendar
          <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
        </Link>
      </div>
    </Card>
  );
}
