"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteDealAction, updateDealStageAction } from "@/actions/business-actions";
import { DealTaskItem } from "@/components/business/deal-task-item";
import { AddDealTaskForm } from "@/components/business/add-deal-task-form";
import type { Database } from "@/lib/supabase/database.types";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type DealTask = Database["public"]["Tables"]["deal_tasks"]["Row"];

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

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
    <div className={cn("rounded-lg border border-border bg-card p-3", isPending && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/business/pipeline/${deal.id}`} className="truncate text-sm font-medium hover:underline">
            {contact?.contact_person ?? "Unknown contact"}
          </Link>
          {contact?.company_name ? (
            <p className="truncate text-xs text-muted-foreground">{contact.company_name}</p>
          ) : null}
        </div>
        <button
          onClick={() => startTransition(() => deleteDealAction(deal.id))}
          aria-label="Delete deal"
          className="relative after:absolute after:-inset-3.5 shrink-0 text-muted-foreground hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <p className="font-mono text-sm text-brand">{money(Number(deal.value))}</p>
      </div>

      {deal.notes ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{deal.notes}</p> : null}

      <div className="mt-2">
        <Select value={stageId} onValueChange={(v) => v && handleMove(v)}>
          <SelectTrigger className="h-7 w-full text-xs">
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

      {tasks.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {tasks.map((t) => (
            <DealTaskItem key={t.id} task={t} />
          ))}
        </ul>
      ) : null}
      <AddDealTaskForm dealId={deal.id} />
    </div>
  );
}
