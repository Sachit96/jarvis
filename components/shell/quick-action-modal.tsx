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
import type { Database } from "@/lib/supabase/database.types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

interface QAState {
  error?: string;
}
const initialState: QAState = {};

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
        <Input id="qa-title" name="title" required autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="qa-priority">Priority</Label>
          <Select name="priority" defaultValue="medium">
            <SelectTrigger id="qa-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qa-due">Due date</Label>
          <Input id="qa-due" name="due_date" type="date" />
        </div>
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
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
          <Input id="qa-pair" name="asset_pair" placeholder="EUR/USD" required autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qa-direction">Direction</Label>
          <Select name="direction" defaultValue="long">
            <SelectTrigger id="qa-direction" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="qa-entry">Entry price</Label>
        <Input id="qa-entry" name="entry_price" type="number" step="any" min="0.00000001" required />
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
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
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qa-amount">Amount</Label>
          <Input id="qa-amount" name="amount" type="number" step="0.01" min="0.01" required autoFocus />
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
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="qa-category">Category</Label>
        <Input id="qa-category" name="category" placeholder="Business, Personal…" required />
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
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
        <Input id="qa-body" name="body" placeholder="What's on your mind?" required autoFocus />
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
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
        className="text-muted-foreground hover:text-foreground"
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
