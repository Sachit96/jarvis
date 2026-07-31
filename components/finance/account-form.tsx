"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createAccountAction } from "@/actions/finance-actions";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
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

export function AccountForm() {
  const [open, setOpen] = useState(false);
  const [accountType, setAccountType] = useState("cash");
  const [state, formAction, isPending] = useActionState(createAccountAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      setAccountType("cash");
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New account
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required autoFocus {...fieldAria(state, "name")} />
            <FieldError id="name-error" message={state.fieldErrors?.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account_type">Type</Label>
            <Select
              name="account_type"
              defaultValue="cash"
              onValueChange={(value) => setAccountType(value ?? "cash")}
            >
              <SelectTrigger id="account_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash" label="Cash">Cash</SelectItem>
                <SelectItem value="savings" label="Savings">Savings</SelectItem>
                <SelectItem value="credit" label="Credit">Credit</SelectItem>
                <SelectItem value="investment" label="Investment / Trading">Investment / Trading</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="current_balance">
              {accountType === "credit" ? "Current amount owed" : "Opening balance"}
            </Label>
            <Input
              id="current_balance"
              name="current_balance"
              type="number"
              step="0.01"
              defaultValue="0"
              required
              {...fieldAria(state, "current_balance")}
            />
            <FieldError id="current_balance-error" message={state.fieldErrors?.current_balance} />
          </div>
          {state.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Adding…" : "Add account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
