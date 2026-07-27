"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { changePasswordAction, type AuthFormState } from "@/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = {};

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [justSaved, setJustSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      setJustSaved(true);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  return (
    <form ref={formRef} action={formAction} onSubmit={() => setJustSaved(false)} className="mt-3 space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
          {isPending ? "Saving…" : "Update"}
        </Button>
      </div>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {justSaved ? <p className="text-xs text-success">Updated.</p> : null}
    </form>
  );
}
