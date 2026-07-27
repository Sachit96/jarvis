"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createTradeAction, type ActionState } from "@/actions/finance-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const initialState: ActionState = {};

function nowLocalDatetime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function TradeForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createTradeAction, initialState);
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
            <Plus className="h-4 w-4" /> New trade
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New trade</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="asset_pair">Asset / Pair</Label>
              <Input id="asset_pair" name="asset_pair" placeholder="BTC/USD" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direction">Direction</Label>
              <Select name="direction" defaultValue="long">
                <SelectTrigger id="direction" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entry_price">Entry price</Label>
              <Input id="entry_price" name="entry_price" type="number" step="any" min="0.00000001" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" type="number" step="any" min="0.00000001" placeholder="Optional" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exit_price">Exit price</Label>
              <Input id="exit_price" name="exit_price" type="number" step="any" min="0.00000001" placeholder="Leave blank if open" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fees">Fees</Label>
              <Input id="fees" name="fees" type="number" step="0.01" min="0" defaultValue="0" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="setup_category">Setup</Label>
            <Input id="setup_category" name="setup_category" placeholder="Breakout, reversal, scalp…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opened_at">Opened at</Label>
            <Input id="opened_at" name="opened_at" type="datetime-local" defaultValue={nowLocalDatetime()} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Adding…" : "Add trade"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
