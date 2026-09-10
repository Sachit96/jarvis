"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { VoiceDashboardData } from "@/lib/db/queries/voice";

/**
 * The HUD's state machine. Widened when Voice was connected to the operator:
 * a turn that runs tools takes long enough that "thinking" alone leaves the
 * user staring at an unchanging ring, and a turn awaiting spoken approval is
 * a genuinely different state from one that is merely slow.
 */
export type VoiceStatusMode =
  | "idle"
  | "listening"
  /** Listening AND words are arriving — see displayMode in voice-mode-client. */
  | "transcribing"
  | "thinking"
  | "executing"
  | "waiting_for_confirmation"
  | "speaking"
  | "error";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Deliberately NOT the app's Card. This is a heads-up overlay on a live
// animated background, so it needs to stay legible over whatever is moving
// underneath without becoming an opaque box that hides it: a heavier blur
// carries the legibility, a brand-tinted hairline plus a top inset highlight
// give the glass an edge, and the fill stays dark and translucent.
const PANEL_CLASS =
  "pointer-events-none rounded-xl border border-brand/15 bg-black/50 p-4 font-mono shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md";
const LABEL_CLASS = "text-[10px] uppercase tracking-[0.15em] text-brand/80";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-white/50">{label}</span>
      <span className="tabular-nums text-white/90">{value}</span>
    </div>
  );
}

export function TopLeftPanel({ data }: { data: VoiceDashboardData["last7Days"] }) {
  return (
    <div className={cn(PANEL_CLASS, "w-64")}>
      <p className={LABEL_CLASS}>Last 7 Days</p>
      <div className="mt-3 space-y-2">
        <Row label="New Clients Onboarded" value={String(data.newClientsOnboarded)} />
        <Row label="MRR" value={money(data.mrr)} />
        <Row label="Cash Collected" value={money(data.cashCollected)} />
      </div>
    </div>
  );
}

export function TopRightPanel({ data }: { data: VoiceDashboardData["today"] }) {
  return (
    <div className={cn(PANEL_CLASS, "w-64")}>
      <p className={LABEL_CLASS}>Today</p>
      <div className="mt-3 space-y-2">
        <Row label="Tasks" value={`${data.tasksCompleted} / ${data.tasksTotal}`} />
        <Row label="Habits" value={`${data.habitsCompleted} / ${data.habitsTotal}`} />
        <Row label="Calories Logged" value={String(data.caloriesLogged)} />
        <Row label="Workouts" value={String(data.workoutsToday)} />
      </div>
    </div>
  );
}

interface StatusRailProps {
  moduleStatus: VoiceDashboardData["moduleStatus"];
  geminiBudget: VoiceDashboardData["geminiBudget"];
  voiceSupported: boolean;
  ttsSupported: boolean;
}

export function StatusRail({ moduleStatus, geminiBudget, voiceSupported, ttsSupported }: StatusRailProps) {
  const rows: { label: string; live: boolean }[] = [
    { label: "Memory", live: moduleStatus.memory },
    { label: "Business", live: moduleStatus.business },
    { label: "Health", live: moduleStatus.health },
    { label: "Finance", live: moduleStatus.finance },
    { label: "Goals", live: moduleStatus.goals },
    { label: "Voice", live: voiceSupported },
    { label: "TTS", live: ttsSupported },
  ];
  const remaining = Math.max(0, geminiBudget.limit - geminiBudget.used);
  const budgetLow = remaining <= geminiBudget.limit * 0.1;
  return (
    <div className={cn(PANEL_CLASS, "w-56")}>
      <p className={LABEL_CLASS}>System Status</p>
      <div className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-xs">
            <span className="whitespace-nowrap text-white/50">{r.label}</span>
            <span className={cn("flex items-center gap-1.5 font-medium tabular-nums", r.live ? "text-success" : "text-white/30")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", r.live ? "bg-success shadow-[0_0_6px_var(--success)]" : "bg-white/20")} />
              {r.live ? "LIVE" : "OFF"}
            </span>
          </div>
        ))}
        <div className="mt-1.5 border-t border-white/10 pt-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="whitespace-nowrap text-white/50">Gemini Budget</span>
            <span className={cn("whitespace-nowrap font-medium tabular-nums", budgetLow ? "text-warn" : "text-white/80")}>
              {remaining} / {geminiBudget.limit}
            </span>
          </div>
          {/* Two tiers are tracked independently now — this row always shows
              whichever one is closer to its own ceiling, so the model name
              is shown alongside it rather than assumed. */}
          <p className="mt-0.5 truncate text-[9px] text-white/30">{geminiBudget.model}</p>
        </div>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<VoiceStatusMode, string> = {
  idle: 'LISTENING FOR "HEY JARVIS"',
  listening: "LISTENING",
  transcribing: "TRANSCRIBING",
  thinking: "THINKING",
  executing: "WORKING",
  waiting_for_confirmation: "AWAITING YOUR CONFIRMATION",
  speaking: "SPEAKING",
  error: "SOMETHING WENT WRONG",
};

export function StatusPill({ mode }: { mode: VoiceStatusMode }) {
  return (
    <div
      data-status-pill={mode}
      className={cn(
        PANEL_CLASS,
        "rounded-full px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors",
        mode === "listening" && "border-brand/50 text-brand",
        mode === "thinking" && "border-brand-2/50 text-brand-2",
        mode === "executing" && "border-brand-2/50 text-brand-2",
        // Amber, and the only state whose label is a full sentence: the user
        // has to notice this one, because nothing proceeds until they answer.
        mode === "waiting_for_confirmation" && "border-warn/60 text-warn",
        mode === "error" && "border-danger/50 text-danger",
        mode === "speaking" && "border-brand/50 text-brand",
        mode === "idle" && "text-white/50",
      )}
    >
      {STATUS_LABEL[mode]}
    </div>
  );
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Deferred via setTimeout(0), not called synchronously in the effect
    // body, so the very first tick is on the same async footing as every
    // tick after it — and it means server/first-client render always agree
    // (both render null, "--:--:--", before hydration settles).
    const first = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return now;
}

interface SubtitleProps {
  finalText: string;
  interimText: string;
  replyText: string;
}

/**
 * The most functionally important text on screen — large and high-contrast
 * enough to read across a room. Shows JARVIS's spoken reply (once one
 * exists) in brand color; otherwise the user's own live transcript, final
 * text in white and the still-recognizing interim tail dimmed grey.
 */
export function Subtitle({ finalText, interimText, replyText }: SubtitleProps) {
  if (!replyText && !finalText && !interimText) return null;
  return (
    <div className="mx-auto max-w-4xl text-center" data-subtitle>
      <p className="text-2xl font-medium leading-snug drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:text-3xl">
        {replyText ? (
          <span className="text-brand">{replyText}</span>
        ) : (
          <>
            <span className="text-white">{finalText}</span>
            {interimText ? <span className="text-white/40"> {interimText}</span> : null}
          </>
        )}
      </p>
    </div>
  );
}

export function StatusStrip({ micActive }: { micActive: boolean }) {
  const now = useClock();
  return (
    <div className="flex items-center gap-4 rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono backdrop-blur-sm">
      <span className={cn("flex items-center gap-1.5 text-[10px] uppercase tracking-wide", micActive ? "text-danger" : "text-white/30")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", micActive ? "animate-pulse bg-danger" : "bg-white/20")} />
        {micActive ? "Mic live" : "Mic off"}
      </span>
      <span className="text-[10px] tabular-nums text-white/40">
        {now ? now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}
      </span>
    </div>
  );
}


export interface VoiceTraceEntry {
  name: string;
  label: string;
  ok: boolean;
}

/**
 * What JARVIS just did, in the HUD's own idiom.
 *
 * Voice hides the reasoning that the chat transcript makes visible, so
 * without this a spoken "done" is unverifiable — the user has no way to know
 * whether anything was actually changed. Labels only; raw results and error
 * detail stay out of the HUD.
 */
export function ActivityStrip({ entries }: { entries: VoiceTraceEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className={cn(PANEL_CLASS, "w-64")}>
      <p className={LABEL_CLASS}>Activity</p>
      <ul className="mt-3 space-y-1.5">
        {entries.slice(-5).map((entry, i) => (
          <li key={`${entry.name}-${i}`} className="flex items-start gap-1.5 text-xs">
            <span className={cn("mt-0.5 shrink-0", entry.ok ? "text-success" : "text-warn")}>
              {entry.ok ? "\u2713" : "!"}
            </span>
            <span className="text-white/70">{entry.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
