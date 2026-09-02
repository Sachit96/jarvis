"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { syncHevyAction } from "@/actions/hevy-actions";

export function HevySyncButton({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleSync() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await syncHevyAction();
        setMessage(result.message ?? (result.ok ? "Synced" : "Sync failed"));
        if (result.ok) router.refresh();
      } catch {
        setMessage("Sync failed");
      }
    });
  }

  if (!connected) {
    return <p className="text-xs text-muted-foreground">Set HEVY_API_KEY to enable Hevy sync.</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" className="gap-1.5" onClick={handleSync} disabled={isPending}>
        <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
        {isPending ? "Syncing…" : "Sync Hevy"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
