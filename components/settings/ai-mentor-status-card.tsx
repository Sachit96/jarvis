"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { testGeminiConnectionAction } from "@/actions/settings-actions";

export function AiMentorStatusCard({ hasKey, model }: { hasKey: boolean; model: string }) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleTest() {
    startTransition(async () => {
      const r = await testGeminiConnectionAction();
      setResult(r);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">AI Mentor (Gemini)</p>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {hasKey ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <XCircle className="h-4 w-4 text-danger" />
        )}
        <span>{hasKey ? "GEMINI_API_KEY is configured" : "GEMINI_API_KEY is not set"}</span>
      </div>
      <p className="mt-1 font-mono text-xs text-muted-foreground">model: {model}</p>
      {!hasKey ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Set GEMINI_API_KEY in your environment variables (.env.local locally, Netlify env vars in
          production) to enable the AI Mentor — this key also powers Lead Research.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <Button size="sm" variant="secondary" onClick={handleTest} disabled={isPending}>
            {isPending ? "Testing…" : "Test connection"}
          </Button>
          {result ? (
            <p className={cn("text-xs", result.ok ? "text-success" : "text-danger")}>{result.message}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
