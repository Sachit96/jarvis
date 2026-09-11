"use client";

import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The quick prompts.
 *
 * Deliberately phrased as openings rather than complete commands — the
 * point is to start the sentence for you when you cannot think what to
 * say, not to fire a canned action whose wording you never chose.
 */
export const QUICK_PROMPTS = [
  "Good morning",
  "What should I focus on?",
  "Remind me to",
  "Show me my pipeline",
] as const;

/**
 * The floating control pill, anchored to the bottom.
 *
 * Mic toggle, quick prompts, and the live transcript directly underneath.
 * The transcript sits below rather than inside the pill so a long utterance
 * grows downward into empty space instead of stretching the controls and
 * moving the mic button out from under your thumb mid-sentence.
 */
export function VoiceControlBar({
  micOn,
  onToggleMic,
  onQuickPrompt,
  listening,
  disabled,
  finalText,
  interimText,
  replyText,
}: {
  micOn: boolean;
  onToggleMic: () => void;
  onQuickPrompt: (text: string) => void;
  listening: boolean;
  /** Speech recognition unsupported here — the mic cannot do anything. */
  disabled?: boolean;
  finalText: string;
  interimText: string;
  replyText: string;
}) {
  const transcript = interimText || finalText;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full max-w-2xl items-center gap-2 rounded-full border border-white/10 bg-black/40 p-2 backdrop-blur-md shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06),0_8px_32px_-12px_rgb(0_0_0/0.9)]">
        <button
          type="button"
          onClick={onToggleMic}
          disabled={disabled}
          aria-pressed={micOn}
          aria-label={micOn ? "Stop listening" : "Start listening"}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-40",
            micOn
              ? "border-brand/60 bg-brand/15 text-brand"
              : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10",
            listening && "animate-pulse",
          )}
        >
          {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </button>

        {/* Horizontally scrollable rather than wrapping: a wrapped second
            row would change the pill's height as the viewport narrows and
            push the transcript off the bottom of the screen. */}
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onQuickPrompt(prompt)}
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[12px] text-white/70 transition-all hover:border-brand/50 hover:bg-white/10 hover:text-white focus-visible:border-brand/50 focus-visible:outline-none"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Reserved height so the layout does not jump the moment the first
          word arrives. */}
      <div className="flex min-h-12 w-full max-w-3xl items-start justify-center px-2 text-center">
        {transcript ? (
          <p className="text-[15px] leading-snug text-white">
            {finalText}
            {interimText ? <span className="text-white/45">{finalText ? " " : ""}{interimText}</span> : null}
          </p>
        ) : replyText ? (
          <p className="text-[15px] leading-snug text-brand-2">{replyText}</p>
        ) : (
          <p className="text-[12px] tracking-[0.16em] text-white/30 uppercase">
            {disabled
              ? "Speech recognition unavailable in this browser"
              : micOn
                ? "Hold space, or just say “Hey JARVIS”"
                : "Turn the mic on to talk"}
          </p>
        )}
      </div>
    </div>
  );
}
