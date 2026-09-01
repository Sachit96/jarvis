"use client";

import { useState, useTransition } from "react";
import { Upload, AlertTriangle, X, Check } from "lucide-react";
import { parseSyllabusAction, confirmSyllabusAction } from "@/actions/uni-parse-actions";
import type { SyllabusParseResult } from "@/lib/validations/uni-parse";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASSESSMENT_TYPES } from "@/lib/validations/uni";

type EditableAssessment = { title: string; type: string; due_date: string | null; weight_pct: number | null; include: boolean };
type EditableBlock = { type: string; day_of_week: number; start_time: string; end_time: string; room: string | null; include: boolean };

function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve({ data: result.slice(commaIndex + 1), mimeType: file.type || "application/pdf" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SyllabusUpload({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "review">("input");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyllabusParseResult | null>(null);
  const [dateConflicts, setDateConflicts] = useState<{ title: string; due_date: string; conflictsWith: string[] }[]>([]);
  const [professor, setProfessor] = useState("");
  const [professorEmail, setProfessorEmail] = useState("");
  const [assessments, setAssessments] = useState<EditableAssessment[]>([]);
  const [blocks, setBlocks] = useState<EditableBlock[]>([]);

  function reset() {
    setStep("input");
    setText("");
    setFile(null);
    setError(null);
    setResult(null);
    setDateConflicts([]);
  }

  function handleParse() {
    setError(null);
    startTransition(async () => {
      const input = file ? { ...(await fileToBase64(file).then((f) => ({ fileBase64: f.data, fileMimeType: f.mimeType }))) } : { text };
      const res = await parseSyllabusAction(courseId, input);
      if (!res.ok || !res.parsed) {
        setError(res.error ?? "Parse failed");
        return;
      }
      setResult(res.parsed);
      setDateConflicts(res.dateConflicts ?? []);
      setProfessor(res.parsed.professor ?? "");
      setProfessorEmail(res.parsed.professor_email ?? "");
      setAssessments(res.parsed.assessments.map((a) => ({ ...a, include: true })));
      setBlocks(
        res.parsed.scheduleBlocks
          .filter((b) => b.day_of_week != null && b.start_time && b.end_time)
          .map((b) => ({ type: b.type, day_of_week: b.day_of_week!, start_time: b.start_time!, end_time: b.end_time!, room: b.room, include: true })),
      );
      setStep("review");
    });
  }

  function handleConfirm() {
    startTransition(async () => {
      const res = await confirmSyllabusAction({
        courseId,
        professor,
        professor_email: professorEmail,
        assessments: assessments.filter((a) => a.include).map(({ include: _include, ...a }) => a),
        scheduleBlocks: blocks.filter((b) => b.include).map(({ include: _include, ...b }) => b),
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
          <Button size="sm" variant="secondary" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Upload syllabus
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === "input" ? "Upload syllabus" : "Review extracted data"}</DialogTitle>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">PDF file</label>
              <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <p className="text-center text-xs text-muted-foreground">— or —</p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Paste syllabus text</label>
              <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full syllabus text here…" />
            </div>
            {error ? <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
            <Button className="w-full" disabled={isPending || (!file && !text.trim())} onClick={handleParse}>
              {isPending ? "Parsing…" : "Parse syllabus"}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-xs text-muted-foreground">
              Nothing has been saved yet. Review, edit, or uncheck anything below, then confirm.
            </p>

            {dateConflicts.length > 0 ? (
              <div className="space-y-1.5 rounded-lg border border-warn/30 bg-warn/10 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-warn">
                  <AlertTriangle className="h-4 w-4" /> Date conflicts detected
                </p>
                {dateConflicts.map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    &quot;{c.title}&quot; ({c.due_date}) shares a due date with: {c.conflictsWith.join(", ")}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Professor</label>
                <Input value={professor} onChange={(e) => setProfessor(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Professor email</label>
                <Input value={professorEmail} onChange={(e) => setProfessorEmail(e.target.value)} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Assessments ({assessments.length})</p>
              <div className="space-y-2">
                {assessments.map((a, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] p-2">
                    <input type="checkbox" checked={a.include} onChange={(e) => setAssessments((prev) => prev.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
                    <Input
                      className="h-8 flex-1 min-w-[140px] text-sm"
                      value={a.title}
                      onChange={(e) => setAssessments((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    />
                    <Select value={a.type} onValueChange={(v) => v && setAssessments((prev) => prev.map((x, j) => (j === i ? { ...x, type: v } : x)))}>
                      <SelectTrigger className="h-8 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSESSMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t} label={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      className="h-8 w-[130px] text-xs"
                      value={a.due_date ?? ""}
                      onChange={(e) => setAssessments((prev) => prev.map((x, j) => (j === i ? { ...x, due_date: e.target.value || null } : x)))}
                    />
                    <Input
                      type="number"
                      className="h-8 w-[70px] text-xs"
                      placeholder="wt%"
                      value={a.weight_pct ?? ""}
                      onChange={(e) => setAssessments((prev) => prev.map((x, j) => (j === i ? { ...x, weight_pct: e.target.value ? Number(e.target.value) : null } : x)))}
                    />
                  </div>
                ))}
                {assessments.length === 0 ? <p className="text-xs text-muted-foreground/60">None found</p> : null}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Schedule blocks ({blocks.length})</p>
              {blocks.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">None found</p>
              ) : (
                <div className="space-y-1.5">
                  {blocks.map((b, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={b.include} onChange={(e) => setBlocks((prev) => prev.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
                      <span className="capitalize text-foreground">{b.type.replace("_", " ")}</span>
                      <span className="text-muted-foreground">day {b.day_of_week}, {b.start_time}–{b.end_time}{b.room ? `, ${b.room}` : ""}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {result && (result.requiredReadings.length > 0 || result.keyPolicies.length > 0) ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                {result.requiredReadings.length > 0 ? <p><span className="font-medium text-foreground">Readings:</span> {result.requiredReadings.join("; ")}</p> : null}
                {result.keyPolicies.length > 0 ? <p><span className="font-medium text-foreground">Policies:</span> {result.keyPolicies.join("; ")}</p> : null}
              </div>
            ) : null}

            {result && result.unparsed.length > 0 ? (
              <div className="rounded-lg border border-border bg-white/[0.03] p-3">
                <p className="text-xs font-medium text-muted-foreground">Couldn&apos;t confidently parse:</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground/80">
                  {result.unparsed.map((u, i) => (
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
                <Check className="h-4 w-4" /> {isPending ? "Saving…" : "Confirm & add to course"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
