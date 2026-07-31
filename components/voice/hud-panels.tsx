"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { VoiceDashboardData } from "@/lib/db/queries/voice";

export type VoiceStatusMode = "idle" | "listening" | "thinking" | "speaking";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const PANEL_CLASS = "pointer-events-none rounded-lg border border-white/10 bg-black/40 p-4 font-mono backdrop-blur-sm";
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
        <div className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-1.5 text-xs">
          <span className="whitespace-nowrap text-white/50">Gemini Budget</span>
          <span className={cn("whitespace-nowrap font-medium tabular-nums", budgetLow ? "text-warn" : "text-white/80")}>
            {remaining} / {geminiBudget.limit}
          </span>
        </div>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<VoiceStatusMode, string> = {
  idle: 'LISTENING FOR "HEY JARVIS"',
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
};

export function StatusPill({ mode }: { mode: VoiceStatusMode }) {
  return (
    <div
      data-status-pill={mode}
      className={cn(
        PANEL_CLASS,
        "rounded-full px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors",
        mode === "listening" && "border-brand/50 text-brand",
        mode === "thinking" && "border-violet-400/50 text-violet-300",
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
