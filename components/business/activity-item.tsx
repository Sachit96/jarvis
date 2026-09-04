"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { deleteActivityAction } from "@/actions/business-actions";
import type { Database } from "@/lib/supabase/database.types";

type Activity = Database["public"]["Tables"]["activities"]["Row"];

export function ActivityItem({ activity }: { activity: Activity }) {
  const [isPending, startTransition] = useTransition();

  return (
    <li className={cn("flex items-start gap-2 text-xs", isPending && "opacity-50")}>
      <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px] uppercase">
        {activity.type}
      </Badge>
      <span className="min-w-0 flex-1 text-muted-foreground">{activity.notes}</span>
      <span className="shrink-0 font-mono text-muted-foreground">
        {new Date(activity.occurred_at).toLocaleDateString()}
      </span>
      <button
        onClick={() => startTransition(() => deleteActivityAction(activity.id))}
        aria-label="Delete activity"
        className="relative after:absolute after:-inset-3.5 shrink-0 text-muted-foreground hover:text-danger"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}
