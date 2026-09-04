"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CirclePlus } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { createTaskAction } from "@/actions/life-actions";
import { createJournalEntryAction } from "@/actions/life-actions";
import { createTradeAction, createTransactionAction } from "@/actions/finance-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { FieldError } from "@/components/ui/field-error";
import type { Database } from "@/lib/supabase/database.types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

const initialState: ActionState = {};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function nowLocalDatetime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function TaskQuickForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(createTaskAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      onDone();
    }
    wasPending.current = isPending;
  }, [isPending, state.error, onDone]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="qa-title">Title</Label>
        <Input id="qa-title" name="title" required autoFocus {...fieldAria(state, "title")} />
        <FieldError id="title-error" message={state.fieldErrors?.title} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="qa-priority">Priority</Label>
          <Select name="priority" defaultValue="medium">
            <SelectTrigger id="qa-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high" label="High">High</SelectItem>
              <SelectItem value="medium" label="Medium">Medium</SelectItem>
              <SelectItem value="low" label="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qa-due">Due date</Label>
          <Input id="qa-due" name="due_date" type="date" {...fieldAria(state, "due_date")} />
          <FieldError id="due_date-error" message={state.fieldErrors?.due_date} />
        </div>
      </div>
      {state.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Adding…" : "Add task"}
      </Button>
    </form>
  );
}

function TradeQuickForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(createTradeAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      onDone();
    }
    wasPending.current = isPending;
  }, [isPending, state.error, onDone]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="opened_at" value={nowLocalDatetime()} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="qa-pair">Asset / Pair</Label>
          <Input id="qa-pair" name="asset_pair" placeholder="EUR/USD" required autoFocus {...fieldAria(state, "asset_pair")} />
          <FieldError id="asset_pair-error" message={state.fieldErrors?.asset_pair} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qa-direction">Direction</Label>
          <Select name="direction" defaultValue="long">
            <SelectTrigger id="qa-direction" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="long" label="Long">Long</SelectItem>
              <SelectItem value="short" label="Short">Short</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="qa-entry">Entry price</Label>
        <Input id="qa-entry" name="entry_price" type="number" step="any" min="0.00000001" required {...fieldAria(state, "entry_price")} />
        <FieldError id="entry_price-error" message={state.fieldErrors?.entry_price} />
      </div>
      {state.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Adding…" : "Add trade"}
      </Button>
    </form>
  );
}

function TransactionQuickForm({ accounts, onDone }: { accounts: Account[]; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(createTransactionAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      onDone();
    }
    wasPending.current = isPending;
  }, [isPending, state.error, onDone]);

  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground">Add an account on the Finance tab first.</p>;
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="occurred_at" value={todayStr()} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="qa-type">Type</Label>
          <Select name="type" defaultValue="expense">
            <SelectTrigger id="qa-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense" label="Expense">Expense</SelectItem>
              <SelectItem value="income" label="Income">Income</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qa-amount">Amount</Label>
          <Input id="qa-amount" name="amount" type="number" step="0.01" min="0.01" required autoFocus {...fieldAria(state, "amount")} />
          <FieldError id="amount-error" message={state.fieldErrors?.amount} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="qa-account">Account</Label>
        <Select name="account_id" defaultValue={accounts[0]?.id}>
          <SelectTrigger id="qa-account" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id} label={a.name}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id="account_id-error" message={state.fieldErrors?.account_id} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="qa-category">Category</Label>
        <Input id="qa-category" name="category" placeholder="Business, Personal…" required {...fieldAria(state, "category")} />
        <FieldError id="category-error" message={state.fieldErrors?.category} />
      </div>
      {state.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Adding…" : "Add transaction"}
      </Button>
    </form>
  );
}

function JournalQuickForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(createJournalEntryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      onDone();
    }
    wasPending.current = isPending;
  }, [isPending, state.error, onDone]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="entry_date" value={todayStr()} />
      <input type="hidden" name="entry_type" value="freeform" />
      <div className="space-y-1.5">
        <Label htmlFor="qa-body">Quick note</Label>
        <Input id="qa-body" name="body" placeholder="What's on your mind?" required autoFocus {...fieldAria(state, "body")} />
        <FieldError id="body-error" message={state.fieldErrors?.body} />
      </div>
      {state.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Saving…" : "Save entry"}
      </Button>
    </form>
  );
}

export function QuickActionModal({ accounts }: { accounts: Account[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Quick add"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground ring-1 ring-border transition-colors after:absolute after:-inset-1.5 hover:bg-white/[0.04] hover:text-foreground"
      >
        <CirclePlus className="h-[18px] w-[18px]" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick add</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="task">
            <TabsList className="w-full">
              <TabsTrigger value="task">Task</TabsTrigger>
              <TabsTrigger value="trade">Trade</TabsTrigger>
              <TabsTrigger value="transaction">Transaction</TabsTrigger>
              <TabsTrigger value="journal">Journal</TabsTrigger>
            </TabsList>
            <TabsContent value="task">
              <TaskQuickForm onDone={() => setOpen(false)} />
            </TabsContent>
            <TabsContent value="trade">
              <TradeQuickForm onDone={() => setOpen(false)} />
            </TabsContent>
            <TabsContent value="transaction">
              <TransactionQuickForm accounts={accounts} onDone={() => setOpen(false)} />
            </TabsContent>
            <TabsContent value="journal">
              <JournalQuickForm onDone={() => setOpen(false)} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
