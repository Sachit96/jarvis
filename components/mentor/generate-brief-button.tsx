"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BriefActionResult } from "@/actions/mentor-actions";

export function GenerateBriefButton({
  action,
  label,
  hasKey,
}: {
  action: () => Promise<BriefActionResult>;
  label: string;
  hasKey: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      <Button size="sm" className="gap-1.5" onClick={handleClick} disabled={isPending || !hasKey}>
        <Sparkles className="h-3.5 w-3.5" />
        {isPending ? "Thinking…" : label}
      </Button>
      {!hasKey ? <p className="mt-2 text-xs text-warn">GROQ_API_KEY isn&apos;t configured yet.</p> : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
