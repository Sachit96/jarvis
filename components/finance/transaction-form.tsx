"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createTransactionAction, type ActionState } from "@/actions/finance-actions";
import { SUGGESTED_CATEGORIES } from "@/lib/validations/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Database } from "@/lib/supabase/database.types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

const initialState: ActionState = {};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm({ accounts }: { accounts: Account[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createTransactionAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add transaction
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New transaction</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue="expense">
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account_id">Account</Label>
            <Select name="account_id" defaultValue={accounts[0]?.id}>
              <SelectTrigger id="account_id" className="w-full">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" list="category-suggestions" required />
              <datalist id="category-suggestions">
                {SUGGESTED_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="occurred_at">Date</Label>
              <Input id="occurred_at" name="occurred_at" type="date" defaultValue={todayStr()} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Notes</Label>
            <Input id="description" name="description" placeholder="Optional" />
          </div>

          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={isPending || accounts.length === 0}>
            {accounts.length === 0
              ? "Add an account first"
              : isPending
                ? "Adding…"
                : "Add transaction"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
