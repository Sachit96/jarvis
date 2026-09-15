"use client";

import { useState, useTransition } from "react";
import { ListChecks, X, Check } from "lucide-react";
import { parseAssignmentAction, confirmAssignmentBreakdownAction } from "@/actions/uni-parse-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type EditableRequirement = { text: string; include: boolean };
type EditableSession = { dayOffset: number; minutes: number; focus: string; include: boolean };

export function AssignmentBreakdown({ assessmentId, courseId }: { assessmentId: string; courseId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "review">("input");
  const [instructions, setInstructions] = useState("");
  const [hours, setHours] = useState("3");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [estimatedHours, setEstimatedHours] = useState<number | null>(null);
  const [requirements, setRequirements] = useState<EditableRequirement[]>([]);
  const [sessions, setSessions] = useState<EditableSession[]>([]);
  const [unparsed, setUnparsed] = useState<string[]>([]);

  function reset() {
    setStep("input");
    setInstructions("");
    setError(null);
  }

  function handleParse() {
    setError(null);
    startTransition(async () => {
      const res = await parseAssignmentAction(assessmentId, instructions, Number(hours) || 3);
      if (!res.ok || !res.parsed) {
        setError(res.error ?? "Breakdown failed");
        return;
      }
      setEstimatedHours(res.parsed.estimatedHours);
      setRequirements(res.parsed.requirements.map((text) => ({ text, include: true })));
      setSessions(res.parsed.studyPlan.map((s) => ({ ...s, include: true })));
      setUnparsed(res.parsed.unparsed);
      setStep("review");
    });
  }

  function handleConfirm() {
    startTransition(async () => {
      const res = await confirmAssignmentBreakdownAction({
        assessmentId,
        courseId,
        requirements: requirements.filter((r) => r.include).map((r) => r.text),
        estimatedHours,
        studyPlan: sessions.filter((s) => s.include).map(({ dayOffset, minutes, focus }) => ({ dayOffset, minutes, focus })),
      });
      if (!res.ok) {
        setError(res.error ?? "Failed to save");
        return;
      }
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger
        render={
          <button type="button" className="text-muted-foreground/60 hover:text-brand" aria-label="Break down assignment">
            <ListChecks className="h-3.5 w-3.5" />
          </button>
        }
      />
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === "input" ? "Break down assignment" : "Review breakdown"}</DialogTitle>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Assignment instructions</label>
              <Textarea rows={8} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Paste the assignment brief here…" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Hours you have available</label>
              <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            {error ? <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
            <Button className="w-full" disabled={isPending || !instructions.trim()} onClick={handleParse}>
              {isPending ? "Breaking down…" : "Break down"}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-xs text-muted-foreground">Nothing has been saved yet. Uncheck or edit anything below, then confirm.</p>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Requirements checklist ({requirements.length})</p>
              <div className="space-y-1.5">
                {requirements.map((r, i) => (
                  <label key={i} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5" checked={r.include} onChange={(e) => setRequirements((prev) => prev.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
                    <input
                      className="flex-1 border-b border-transparent bg-transparent text-foreground outline-none focus:border-border"
                      value={r.text}
                      onChange={(e) => setRequirements((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                    />
                  </label>
                ))}
                {requirements.length === 0 ? <p className="text-xs text-muted-foreground/60">None extracted</p> : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Estimated hours</label>
              <Input type="number" value={estimatedHours ?? ""} onChange={(e) => setEstimatedHours(e.target.value ? Number(e.target.value) : null)} />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Study plan ({sessions.length} sessions)</p>
              <div className="space-y-1.5">
                {sessions.map((s, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={s.include} onChange={(e) => setSessions((prev) => prev.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
                    <span className="text-muted-foreground">
                      {s.dayOffset === 0 ? "Today" : `+${s.dayOffset}d`} · {s.minutes}min
                    </span>
                    <span className="text-foreground">{s.focus}</span>
                  </label>
                ))}
                {sessions.length === 0 ? <p className="text-xs text-muted-foreground/60">No plan suggested</p> : null}
              </div>
            </div>

            {unparsed.length > 0 ? (
              <div className="rounded-lg border border-border bg-white/[0.03] p-3">
                <p className="text-xs font-medium text-muted-foreground">Couldn&apos;t confidently parse:</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground/80">
                  {unparsed.map((u, i) => (
                    <li key={i}>· {u}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {error ? <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

            <div className="flex gap-2">
              <Button variant="secondary" className="gap-1.5" onClick={reset} disabled={isPending}>
                <X className="h-4 w-4" /> Start over
              </Button>
              <Button className="flex-1 gap-1.5" onClick={handleConfirm} disabled={isPending}>
                <Check className="h-4 w-4" /> {isPending ? "Saving…" : "Confirm & save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
