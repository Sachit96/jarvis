"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * The one destructive-action treatment for an inline row/card delete —
 * found live (2026-09-06 audit): every row (goals, workout sessions,
 * transactions, trades, ...) fires its delete action the instant the trash
 * icon is clicked, no confirmation, no second thought. Click reveals an
 * inline "Delete? / Cancel" row instead of firing immediately — same shape
 * as memory-drawer.tsx's existing confirm step, extracted here so it's one
 * shared pattern instead of every card re-deciding whether to have one.
 */
export function ConfirmDeleteButton({
  onDelete,
  isPending = false,
  label = "item",
  className,
}: {
  onDelete: () => void;
  isPending?: boolean;
  /** Used only in the aria-label / confirm copy, e.g. "session", "goal". */
  label?: string;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
        <Button size="xs" variant="destructive" disabled={isPending} onClick={onDelete}>
          {isPending ? "Deleting…" : "Delete"}
        </Button>
        <Button size="xs" variant="ghost" disabled={isPending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      aria-label={`Delete ${label}`}
      className={cn(
        "relative shrink-0 text-muted-foreground/70 after:absolute after:-inset-3.5 hover:text-danger",
        className,
      )}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
