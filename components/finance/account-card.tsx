"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { deleteAccountAction, adjustAccountBalanceAction } from "@/actions/finance-actions";
import type { Database } from "@/lib/supabase/database.types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

const TYPE_LABEL: Record<string, string> = {
  cash: "Cash",
  savings: "Savings",
  credit: "Credit",
  investment: "Investment",
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AccountCard({ account }: { account: Account }) {
  const isLiability = Boolean(account.is_liability);
  // Displayed value follows the account's own convention: owed-as-positive for credit.
  const [display, setDisplay] = useState(
    isLiability ? Math.abs(Number(account.current_balance)) : Number(account.current_balance),
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(display));
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(() => deleteAccountAction(account.id));
  }

  function handleSave() {
    const next = Number(draft);
    if (Number.isNaN(next)) return;
    const prev = display;
    setDisplay(next);
    setEditing(false);
    startTransition(async () => {
      try {
        await adjustAccountBalanceAction(account.id, next, isLiability);
      } catch {
        setDisplay(prev);
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 border-t-2 border-t-brand transition-opacity",
        isPending && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{account.name}</p>
          <Badge variant="outline" className="mt-1 text-[10px] uppercase">
            {TYPE_LABEL[account.account_type]}
          </Badge>
        </div>
        <button
          onClick={handleDelete}
          aria-label="Delete account"
          className="shrink-0 text-muted-foreground hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {editing ? (
          <>
            <Input
              type="number"
              step="0.01"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 w-28 font-mono"
              autoFocus
            />
            <button onClick={handleSave} aria-label="Save balance" className="text-success">
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setDraft(String(display));
                setEditing(false);
              }}
              aria-label="Cancel"
              className="text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <p className={cn("font-mono text-xl", isLiability && "text-danger")}>
              {isLiability ? "Owed " : ""}${fmt(display)}
            </p>
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit balance"
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
