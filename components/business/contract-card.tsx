"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteContractAction, updateContractStatusAction } from "@/actions/business-actions";
import type { Database } from "@/lib/supabase/database.types";

type Contract = Database["public"]["Tables"]["contracts"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];

const STATUS_TONE: Record<string, string> = {
  active: "text-success border-success/40",
  paused: "text-warn border-warn/40",
  completed: "text-muted-foreground border-border",
  cancelled: "text-danger border-danger/40",
};

function money(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ContractCard({ contract, contact }: { contract: Contract; contact: Contact | undefined }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", isPending && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{contract.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {contact?.contact_person ?? "Unknown client"}
            {contact?.company_name ? ` — ${contact.company_name}` : ""}
          </p>
        </div>
        <button
          onClick={() => startTransition(() => deleteContractAction(contract.id))}
          aria-label="Delete contract"
          className="relative after:absolute after:-inset-3.5 shrink-0 text-muted-foreground hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <p className="font-mono text-lg text-brand">{money(Number(contract.monthly_value))}/mo</p>
        <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_TONE[contract.status])}>
          {contract.status}
        </Badge>
      </div>

      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {contract.start_date} {contract.end_date ? `→ ${contract.end_date}` : "→ ongoing"}
      </p>

      {contract.notes ? <p className="mt-1 text-xs text-muted-foreground">{contract.notes}</p> : null}

      <div className="mt-3">
        <Select
          value={contract.status}
          onValueChange={(v) => v && startTransition(() => updateContractStatusAction(contract.id, v))}
        >
          <SelectTrigger className="h-7 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active" label="Active">Active</SelectItem>
            <SelectItem value="paused" label="Paused">Paused</SelectItem>
            <SelectItem value="completed" label="Completed">Completed</SelectItem>
            <SelectItem value="cancelled" label="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
