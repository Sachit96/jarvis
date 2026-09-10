import Link from "next/link";
import { Activity, Briefcase, HeartPulse, DollarSign, TrendingUp, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { categoryForHref, type Category } from "@/lib/category-colors";
import { IconChip } from "@/components/shared/icon-chip";
import type { ActivityFeedItem } from "@/lib/db/queries/command-center";
import { EmptyState } from "@/components/shared/empty-state";

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  business: Briefcase,
  health: HeartPulse,
  money: DollarSign,
  finance: TrendingUp,
  goals: TrendingUp,
  habits: CheckCircle2,
};

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

/** Column 4 filler. An empty state that fills its container intentionally (centered both axes) doesn't read as dead space the way a top-aligned one does in a tall stretched card. */
export function RecentActivityCard({ items, compact = false, className }: { items: ActivityFeedItem[]; compact?: boolean; className?: string }) {
  return (
    <Card padding={compact ? "compact" : "default"} className={cn("min-h-[100px]", className)}>
      <header className="mb-3 flex shrink-0 items-center justify-between">
        <p className="eyebrow">Recent Activity</p>
        {items.length > 0 ? (
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-caption tabular-nums text-muted-foreground">
            {items.length}
          </span>
        ) : null}
      </header>
      {items.length === 0 ? (
        <EmptyState
          compact
          icon={Activity}
          title="Nothing logged"
          description="Activity from every module shows up here as it happens."
        />
      ) : (
        <ul className="-mx-2 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const category = categoryForHref(item.href) ?? "habits";
            const Icon = CATEGORY_ICON[category];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-white/[0.04]"
                >
                  <IconChip icon={Icon} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="shrink-0 text-caption text-muted-foreground">{item.sublabel}</span>
                  <span className="shrink-0 tabular text-caption text-muted-foreground/70">{timeAgo(item.timestamp)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
