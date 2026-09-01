"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { planTonightAction, confirmStudyPlanAction } from "@/actions/uni-plan-actions";
import type { RankedItem } from "@/lib/uni/study-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function PlanTonight({ assessmentCourseIds }: { assessmentCourseIds: Record<string, string> }) {
  const [hours, setHours] = useState("3");
  const [sessions, setSessions] = useState<RankedItem[] | null>(null);
  const [phrasing, setPhrasing] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handlePlan() {
    setSaved(false);
    startTransition(async () => {
      const res = await planTonightAction(Number(hours) || 3);
      if (res.ok) {
        setSessions(res.sessions ?? []);
        setPhrasing(res.phrasing ?? "");
      }
    });
  }

  function handleSave() {
    if (!sessions) return;
    startTransition(async () => {
      await confirmStudyPlanAction(
        sessions.map((s) => ({ assessmentId: s.assessmentId, courseId: assessmentCourseIds[s.assessmentId], minutes: s.minutes })),
      );
      setSaved(true);
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-caption uppercase tracking-wide text-muted-foreground">Plan tonight</p>
        <div className="flex items-center gap-2">
          <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} className="h-8 w-16 text-sm" />
          <span className="text-xs text-muted-foreground">hours</span>
          <Button size="sm" onClick={handlePlan} disabled={isPending} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> {isPending ? "…" : "Plan"}
          </Button>
        </div>
      </div>

      {sessions ? (
        <div className="mt-3 space-y-3">
          {phrasing ? <p className="text-sm text-foreground">{phrasing}</p> : null}
          {sessions.length > 0 ? (
            <>
              <ul className="space-y-1.5">
                {sessions.map((s) => (
                  <li key={s.assessmentId} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{s.courseCode} — {s.title}</span>
                    <span className="text-caption text-muted-foreground">{s.minutes}min</span>
                  </li>
                ))}
              </ul>
              {saved ? (
                <p className="text-xs text-success">Saved to your study sessions.</p>
              ) : (
                <Button size="sm" variant="secondary" onClick={handleSave} disabled={isPending}>
                  Save these sessions
                </Button>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
