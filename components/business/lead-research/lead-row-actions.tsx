"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal, ArrowRight, RefreshCw, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateDealStageAction } from "@/actions/business-actions";
import { dismissLeadAction, forceRefreshLeadAction, logCallOutcomeAction } from "@/actions/lead-research-actions";
import { CALL_OUTCOMES, CALL_OUTCOME_LABEL } from "@/lib/validations/lead-research";
import type { LeadRowData, PipelineStageRow } from "@/components/business/lead-research/types";

/** The row-action menu for "working a call list top-down" — promote/dismiss/refresh/log-outcome, all without leaving the Lead Research page. */
export function LeadRowActions({ row, stages }: { row: LeadRowData; stages: PipelineStageRow[] }) {
  const [isPending, startTransition] = useTransition();
  const { lead, contact, deal } = row;

  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  const currentIndex = deal ? sortedStages.findIndex((s) => s.id === deal.stage_id) : -1;
  const nextStage = currentIndex >= 0 ? sortedStages[currentIndex + 1] : undefined;

  function handlePromote() {
    if (!deal || !nextStage) return;
    startTransition(async () => {
      await updateDealStageAction(deal.id, nextStage.id);
      toast.success(`Moved to ${nextStage.name}`);
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      await dismissLeadAction(lead.id);
      toast(`Dismissed ${contact?.company_name ?? contact?.contact_person ?? "lead"}`);
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      const result = await forceRefreshLeadAction(lead.id);
      if (result.error) toast.error(result.error);
      else toast.success("Lead refreshed");
    });
  }

  function handleLogCall(outcome: (typeof CALL_OUTCOMES)[number]) {
    startTransition(async () => {
      const result = await logCallOutcomeAction(lead.contact_id, lead.deal_id, outcome);
      if (result.error) toast.error(result.error);
      else toast.success(`Logged: ${CALL_OUTCOME_LABEL[outcome]}`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" disabled={isPending} aria-label="Lead actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Phone className="h-3.5 w-3.5" /> Log call outcome
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {CALL_OUTCOMES.map((outcome) => (
              <DropdownMenuItem key={outcome} onClick={() => handleLogCall(outcome)}>
                {CALL_OUTCOME_LABEL[outcome]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem onClick={handlePromote} disabled={!deal || !nextStage}>
          <ArrowRight className="h-3.5 w-3.5" />
          {nextStage ? `Promote to ${nextStage.name}` : "No further stage"}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleRefresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Force refresh
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Danger zone</DropdownMenuLabel>
        <DropdownMenuItem variant="destructive" onClick={handleDismiss}>
          <X className="h-3.5 w-3.5" /> Dismiss
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
