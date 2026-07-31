"use client";

import { useActionState, useRef, useEffect, useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldAria, type ActionState } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { saveGhlConnectionAction, disconnectGhlAction, syncGhlAction } from "@/actions/ghl-actions";
import type { Database } from "@/lib/supabase/database.types";

type GhlConnection = Database["public"]["Tables"]["ghl_connections"]["Row"];

const initialState: ActionState = {};

function maskToken(token: string) {
  if (token.length <= 4) return "••••";
  return `••••••••${token.slice(-4)}`;
}

export function GhlConnectionCard({ connection }: { connection: GhlConnection | null }) {
  const [editing, setEditing] = useState(!connection);
  const [state, formAction, isPending] = useActionState(saveGhlConnectionAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const [isSyncPending, startSync] = useTransition();
  const [isDisconnectPending, startDisconnect] = useTransition();
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset();
      setEditing(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.error]);

  function handleSync() {
    setSyncResult(null);
    startSync(async () => {
      const r = await syncGhlAction();
      setSyncResult(r);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">GoHighLevel</p>

      {connection && !editing ? (
        <>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Connected — location {connection.location_id}</span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Token {maskToken(connection.private_token)}
            {connection.last_synced_at
              ? ` · last synced ${new Date(connection.last_synced_at).toLocaleString()}`
              : " · never synced"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={handleSync} disabled={isSyncPending}>
              {isSyncPending ? "Syncing…" : "Sync now"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Update credentials
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isDisconnectPending}
              onClick={() => startDisconnect(() => disconnectGhlAction())}
            >
              {isDisconnectPending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
          {syncResult ? (
            <p className={cn("mt-2 text-xs", syncResult.ok ? "text-success" : "text-danger")}>{syncResult.message}</p>
          ) : null}
        </>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <XCircle className="h-4 w-4 text-danger" />
            <span>Not connected</span>
          </div>
          <form ref={formRef} action={formAction} className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="location_id">Location ID</Label>
              <Input
                id="location_id"
                name="location_id"
                defaultValue={connection?.location_id}
                required
                autoFocus
                {...fieldAria(state, "location_id")}
              />
              <FieldError id="location_id-error" message={state.fieldErrors?.location_id} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="private_token">Private Integration Token</Label>
              <Input id="private_token" name="private_token" type="password" required {...fieldAria(state, "private_token")} />
              <FieldError id="private_token-error" message={state.fieldErrors?.private_token} />
            </div>
            {state.error ? (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{state.error}</p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Saving…" : "Save connection"}
              </Button>
              {connection ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Webhook URL: <code className="text-[11px]">/api/webhooks/ghl?secret=&lt;GHL_WEBHOOK_SECRET&gt;</code> — configure
        this in your GHL account to receive live lead/opportunity updates.
      </p>
    </div>
  );
}
