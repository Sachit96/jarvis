"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { deleteJournalEntryAction } from "@/actions/life-actions";
import type { Database } from "@/lib/supabase/database.types";

type JournalEntry = Database["public"]["Tables"]["journal_entries"]["Row"];

const MOOD_EMOJI = ["😞", "🙁", "😐", "🙂", "😄"];

export function JournalEntryCard({ entry }: { entry: JournalEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(() => deleteJournalEntryAction(entry.id));
  }

  const isLong = entry.body.length > 240;
  const shownBody = expanded || !isLong ? entry.body : entry.body.slice(0, 240) + "…";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition-opacity",
        isPending && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{entry.entry_date}</span>
            <Badge variant="outline" className="text-[10px] uppercase">
              {entry.entry_type}
            </Badge>
            {entry.mood ? <span aria-label={`Mood ${entry.mood}/5`}>{MOOD_EMOJI[entry.mood - 1]}</span> : null}
          </div>
          {entry.title ? <p className="mt-1 text-sm font-medium">{entry.title}</p> : null}
        </div>
        <button
          onClick={handleDelete}
          aria-label="Delete entry"
          className="shrink-0 text-muted-foreground hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{shownBody}</p>
      {isLong ? (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-brand hover:underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}
