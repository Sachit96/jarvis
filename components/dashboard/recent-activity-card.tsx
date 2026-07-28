import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { ActivityFeedItem } from "@/lib/db/queries/command-center";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function RecentActivityCard({ items }: { items: ActivityFeedItem[] }) {
  return (
    <Card>
      <p className="text-label uppercase tracking-wide text-muted-foreground">Recent Activity</p>
      {items.length === 0 ? (
        <p className="mt-3 text-body text-muted-foreground">Nothing logged yet — activity across every module shows up here.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex items-center gap-2 text-body hover:text-brand">
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="shrink-0 text-caption text-muted-foreground">{item.sublabel}</span>
                <span className="shrink-0 font-mono text-caption text-muted-foreground/70">{timeAgo(item.timestamp)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
