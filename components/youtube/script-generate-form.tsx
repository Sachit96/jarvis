"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { generateScriptAction } from "@/actions/youtube-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function ScriptGenerateForm() {
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    if (!topic.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await generateScriptAction(topic, niche);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      setTopic("");
    });
  }

  return (
    <Card>
      <p className="text-caption uppercase tracking-wide text-muted-foreground">New script</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Input placeholder="Topic — e.g. 'why most budgets fail'" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleGenerate()} />
        <Input placeholder="Niche (optional) — e.g. personal finance" value={niche} onChange={(e) => setNiche(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleGenerate()} />
        <Button onClick={handleGenerate} disabled={isPending || !topic.trim()} className="gap-1.5">
          <Sparkles className="h-4 w-4" /> {isPending ? "Researching + writing…" : "Generate"}
        </Button>
      </div>
      {error ? <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
    </Card>
  );
}
