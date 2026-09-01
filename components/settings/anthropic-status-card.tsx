"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { updateAnthropicSpendCapAction } from "@/actions/anthropic-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AnthropicStatusCard({ hasKey, spentUsd, capUsd }: { hasKey: boolean; spentUsd: number; capUsd: number }) {
  const [cap, setCap] = useState(String(capUsd));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const underCap = spentUsd < capUsd;

  function handleSave() {
    const n = Number(cap);
    if (!Number.isFinite(n)) return;
    setSaved(false);
    startTransition(async () => {
      const res = await updateAnthropicSpendCapAction(n);
      if (res.ok) setSaved(true);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Lead Qualifier (Anthropic) — paid, no free tier</p>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {hasKey ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}
        <span>{hasKey ? "ANTHROPIC_API_KEY is configured" : "ANTHROPIC_API_KEY is not set — lead qualification stays on Gemini"}</span>
      </div>
      {hasKey ? (
        <p className={`mt-1 font-mono text-xs ${underCap ? "text-muted-foreground" : "text-danger"}`}>
          spend: ${spentUsd.toFixed(4)} / ${capUsd.toFixed(2)} {underCap ? "" : "— cap reached, falling back to Gemini"}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <Input type="number" step="0.01" min={0} value={cap} onChange={(e) => setCap(e.target.value)} className="h-8 w-24 text-sm" />
        <Button size="sm" variant="secondary" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Set cap"}
        </Button>
        {saved ? <span className="text-xs text-success">Saved</span> : null}
      </div>
    </div>
  );
}
