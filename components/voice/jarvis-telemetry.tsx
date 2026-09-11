"use client";

import { cn } from "@/lib/utils";
import type { VoiceStatusMode } from "@/components/voice/hud-panels";

/**
 * How the telemetry ring reads each state.
 *
 * Three bands, not eight: the ring answers "can it hear me / is it working
 * / is it talking", and the finer distinctions (transcribing vs listening,
 * executing vs thinking) already have a home in the status pill. Repeating
 * them here would mean two widgets disagreeing about how to say the same
 * thing.
 */
const BAND: Record<VoiceStatusMode, { label: string; tone: string; ring: string }> = {
  idle: { label: "ONLINE", tone: "text-success", ring: "var(--success)" },
  listening: { label: "ONLINE", tone: "text-success", ring: "var(--success)" },
  transcribing: { label: "THINKING", tone: "text-brand-2", ring: "var(--brand-2)" },
  thinking: { label: "THINKING", tone: "text-brand-2", ring: "var(--brand-2)" },
  executing: { label: "THINKING", tone: "text-brand-2", ring: "var(--brand-2)" },
  waiting_for_confirmation: { label: "AWAITING YOU", tone: "text-warn", ring: "var(--warn)" },
  speaking: { label: "SPEAKING", tone: "text-brand", ring: "var(--brand)" },
  error: { label: "FAULT", tone: "text-danger", ring: "var(--danger)" },
};

const BARS = 28;

/**
 * The circular telemetry gauge.
 *
 * Two rings and a ring of bars. The bars are driven by a real level —
 * microphone amplitude while listening, the speech envelope while speaking
 * — rather than a decorative loop, so the gauge moving always means sound
 * is genuinely moving through the system. At rest they sit at a floor
 * height instead of collapsing to nothing, which would read as a fault.
 */
export function JarvisTelemetry({
  mode,
  level,
  model,
  budget,
  className,
}: {
  mode: VoiceStatusMode;
  /** 0–1. Mic amplitude, or the synthetic envelope while speaking. */
  level: number;
  /** The real model behind this turn, shown as the active-LLM badge. */
  model: string;
  /** Today's quota for that model. Omitted when there is nothing to report. */
  budget?: { used: number; limit: number };
  className?: string;
}) {
  const band = BAND[mode];
  const working = mode === "thinking" || mode === "executing" || mode === "transcribing";
  const clamped = Math.max(0, Math.min(1, level));

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative size-44">
        <svg viewBox="0 0 200 200" className="size-full" aria-hidden>
          <circle cx="100" cy="100" r="92" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="1" />
          <circle
            cx="100"
            cy="100"
            r="72"
            fill="none"
            stroke={band.ring}
            strokeWidth="1"
            opacity="0.35"
            strokeDasharray="4 10"
            className={working ? "animate-spin [animation-duration:9s] [transform-origin:100px_100px]" : undefined}
          />
          {Array.from({ length: BARS }, (_, i) => {
            const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2;
            // A floor of 6px so a silent gauge still reads as powered, and
            // a per-bar offset so the ring animates as a wave rather than
            // every bar jumping together.
            const wave = 0.55 + 0.45 * Math.sin(i * 0.9);
            const len = 6 + clamped * 26 * wave;
            const inner = 78;
            return (
              <line
                key={i}
                x1={100 + Math.cos(angle) * inner}
                y1={100 + Math.sin(angle) * inner}
                x2={100 + Math.cos(angle) * (inner + len)}
                y2={100 + Math.sin(angle) * (inner + len)}
                stroke={band.ring}
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity={0.25 + clamped * 0.65}
              />
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-display text-[15px] tracking-[0.28em] text-white">J.A.R.V.I.S.</p>
          <p className={cn("mt-1.5 flex items-center gap-1.5 text-[10px] tracking-[0.2em]", band.tone)}>
            <span
              className={cn("size-1.5 rounded-full", working && "animate-pulse")}
              style={{ backgroundColor: band.ring, boxShadow: `0 0 6px ${band.ring}` }}
            />
            {band.label}
          </p>
        </div>
      </div>

      {/* Which model is actually answering. Named, not branded: a badge
          claiming a model the app does not run is worse than no badge. */}
      <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] tracking-[0.16em] text-white/60 uppercase backdrop-blur-md">
        <span className="size-1.5 rounded-full bg-brand shadow-[0_0_6px_var(--brand)]" />
        {model}
      </span>

      {/* The quota readout the old status rail carried. One line rather than
          a panel — losing it entirely would mean the one screen that spends
          the budget is the one screen that cannot see it. */}
      {budget && budget.limit > 0 ? (
        <p className="tabular text-[10px] tracking-[0.14em] text-white/35 uppercase">
          {budget.used} / {budget.limit} today
        </p>
      ) : null}
    </div>
  );
}
