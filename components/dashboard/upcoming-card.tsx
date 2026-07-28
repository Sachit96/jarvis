import Link from "next/link";
import { Target, ListChecks } from "lucide-react";
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
      <p className="text-label uppercase tracking-wide text-muted-foreground">Upcoming</p>
      {items.length === 0 ? (
        <p className="mt-3 text-body text-muted-foreground">Nothing on the horizon — you&apos;re caught up.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((item) => {
            const Icon = item.kind === "task" ? ListChecks : Target;
            return (
              <li key={item.id}>
                <Link href={item.href} className="flex items-center gap-2 text-body hover:text-brand">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="shrink-0 font-mono text-caption text-muted-foreground">{formatDate(item.date)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
