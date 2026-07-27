"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { closeTradeAction, type ActionState } from "@/actions/finance-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Database } from "@/lib/supabase/database.types";

type Trade = Database["public"]["Tables"]["trades"]["Row"];

const initialState: ActionState = {};

export function CloseTradeForm({ trade }: { trade: Trade }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(closeTradeAction, initialState);
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
      <DialogTrigger render={<Button size="sm" variant="secondary">Close trade</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close {trade.asset_pair}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={trade.id} />
          <input type="hidden" name="direction" value={trade.direction} />
          <input type="hidden" name="entry_price" value={trade.entry_price} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exit_price">Exit price</Label>
              <Input id="exit_price" name="exit_price" type="number" step="any" min="0.00000001" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                step="any"
                min="0.00000001"
                defaultValue={trade.quantity ?? ""}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fees">Fees</Label>
            <Input id="fees" name="fees" type="number" step="0.01" min="0" defaultValue={trade.fees} />
          </div>
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Closing…" : "Close trade"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
