"use client";

import { useState, useTransition } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { askMaterialQuestionAction } from "@/actions/uni-plan-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function MaterialQa({ courseId, hasMaterials }: { courseId: string; hasMaterials: boolean }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [usedMaterials, setUsedMaterials] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAsk() {
    if (!question.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await askMaterialQuestionAction(courseId, question);
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      setAnswer(res.answer ?? null);
      setUsedMaterials(res.usedMaterials ?? []);
    });
  }

  if (!hasMaterials) return null;

  return (
    <Dialog onOpenChange={(v) => { if (!v) { setAnswer(null); setQuestion(""); setError(null); } }}>
      <DialogTrigger
        render={
          <Button size="sm" variant="secondary" className="gap-1.5">
            <MessageCircleQuestion className="h-3.5 w-3.5" /> Ask
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ask about this course&apos;s materials</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What does the syllabus say about late penalties?" onKeyDown={(e) => e.key === "Enter" && handleAsk()} />
            <Button onClick={handleAsk} disabled={isPending || !question.trim()}>
              {isPending ? "…" : "Ask"}
            </Button>
          </div>
          {error ? <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          {answer ? (
            <div className="rounded-lg bg-white/[0.04] p-3 text-sm text-foreground">
              <p>{answer}</p>
              {usedMaterials.length > 0 ? <p className="mt-2 text-xs text-muted-foreground">Used: {usedMaterials.join(", ")}</p> : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
