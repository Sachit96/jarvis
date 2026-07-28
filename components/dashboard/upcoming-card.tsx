import Link from "next/link";
import { Target, ListChecks, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
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

export function UpcomingCard({ items }: { items: UpcomingItem[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-label uppercase tracking-wide text-muted-foreground">Upcoming</p>
        {items.length > 0 ? (
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-caption text-muted-foreground">
            {items.length}
          </span>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-body text-muted-foreground">Nothing on the horizon — you&apos;re caught up.</p>
      ) : (
        <ul className="mt-2 -mx-2">
          {items.map((item) => {
            const Icon = item.kind === "task" ? ListChecks : Target;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-body transition-colors hover:bg-white/[0.04]"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="shrink-0 font-mono text-caption text-muted-foreground">{formatDate(item.date)}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
