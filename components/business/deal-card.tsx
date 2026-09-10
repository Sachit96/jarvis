"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckSquare, Clock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteDealAction, updateDealStageAction } from "@/actions/business-actions";
import type { Database } from "@/lib/supabase/database.types";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type DealTask = Database["public"]["Tables"]["deal_tasks"]["Row"];

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Whole days since a timestamp. */
function ageInDays(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/**
 * One deal on the pipeline board.
 *
 * Compact on purpose. This card used to carry a full-width stage select, a
 * rendered task list AND an always-mounted "add follow-up task" form — three
 * controls per card, on every card, in every column. A board with a dozen
 * deals was a wall of inputs, and the thing a board is actually for (seeing
 * where everything stands) was the hardest thing to do on it.
 *
 * What stays is what you do FROM the board: read the deal, see how long it
 * has sat, and move it. Tasks, notes and activity live on the deal's own
 * page, one click away, where there is room for them.
 */
export function DealCard({
  deal,
  contact,
  stages,
  tasks,
}: {
  deal: Deal;
  contact: Contact | undefined;
  stages: Stage[];
  tasks: DealTask[];
}) {
  const [stageId, setStageId] = useState(deal.stage_id);
  const [isPending, startTransition] = useTransition();

  const age = ageInDays(deal.stage_changed_at ?? deal.created_at);
  const openTasks = tasks.filter((t) => !t.completed).length;

  function handleMove(next: string) {
    const prev = stageId;
    setStageId(next);
    startTransition(async () => {
      try {
        await updateDealStageAction(deal.id, next);
      } catch {
        setStageId(prev);
      }
    });
  }

  return (
    <div
      className={cn(
        "surface surface-interactive group/deal p-3",
        isPending && "opacity-70",
        // A deal that has sat in one stage for over a month gets a warm edge.
        // Ageing is the signal this board exists to surface, so it belongs on
        // the card rather than only in a summary underneath it.
        age >= 30 && "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.055),0_0_0_1px_var(--warn)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/business/pipeline/${deal.id}`}
            className="truncate text-body font-medium text-foreground hover:underline"
          >
            {deal.title || contact?.contact_person || "Untitled deal"}
          </Link>
          {contact?.company_name ? (
            <p className="truncate text-caption text-foreground-tertiary">{contact.company_name}</p>
          ) : null}
        </div>
        <button
          onClick={() => startTransition(() => deleteDealAction(deal.id))}
          aria-label="Delete deal"
          className="relative shrink-0 text-foreground-tertiary opacity-0 transition-opacity after:absolute after:-inset-3 group-hover/deal:opacity-100 hover:text-danger focus-visible:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <p className="tabular mt-2 font-display text-body font-semibold text-foreground">
        {money(Number(deal.value))}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-foreground-tertiary">
        <span className={cn("inline-flex items-center gap-1", age >= 30 && "text-warn")}>
          <Clock className="size-3" strokeWidth={2} />
          {age}d in stage
        </span>
        {openTasks > 0 ? (
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="size-3" strokeWidth={2} />
            {openTasks} open
          </span>
        ) : null}
      </div>

      <Select value={stageId} onValueChange={(v) => v && handleMove(v)}>
        <SelectTrigger
          className="mt-2.5 h-7 w-full border-white/[0.08] bg-white/[0.03] text-caption"
          aria-label="Move deal to stage"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {stages.map((s) => (
            <SelectItem key={s.id} value={s.id} label={s.name}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
