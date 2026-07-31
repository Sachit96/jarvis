"use client";

import { useTransition } from "react";
import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/time";
import { bodyPreview } from "@/lib/mentor-format";
import { toggleMemoryPinnedAction } from "@/actions/memory-actions";
import { MemoryTypeBadge } from "@/components/memory/memory-type-badge";
import type { MemoryEntry } from "@/lib/db/queries/memory";
import type { MemoryType } from "@/lib/validations/memory";

export function MemoryCard({ entry, onOpen }: { entry: MemoryEntry; onOpen: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handlePinToggle(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(() => toggleMemoryPinnedAction(entry.id, !entry.pinned));
  }

  return (
    <Card
      interactive
      onClick={onOpen}
      className={cn("group flex flex-col gap-2", entry.pinned && "ring-brand/40", isPending && "opacity-70")}
    >
      <div className="flex items-start justify-between gap-2">
        <MemoryTypeBadge type={entry.type as MemoryType} />
        <button
          onClick={handlePinToggle}
          aria-label={entry.pinned ? "Unpin" : "Pin"}
          className={cn(
            "shrink-0 rounded-md p-1 transition-opacity",
            entry.pinned ? "text-brand opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground",
          )}
        >
          <Pin className="h-3.5 w-3.5" fill={entry.pinned ? "currentColor" : "none"} />
        </button>
      </div>

      <p className="font-medium text-foreground">{entry.title}</p>
      <p className="line-clamp-3 text-body text-muted-foreground">{bodyPreview(entry.body, entry.title)}</p>

      {entry.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      <p className="mt-auto pt-1 text-caption text-muted-foreground/70">Updated {timeAgo(entry.updated_at)}</p>
    </Card>
  );
}
