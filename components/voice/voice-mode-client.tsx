"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { X, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/lib/voice/use-speech-recognition";
import { useMicAudioLevel } from "@/lib/voice/use-mic-audio-level";
import { useSyntheticEnvelope } from "@/lib/voice/use-synthetic-envelope";
import { browserTts } from "@/lib/voice/tts";
import { sendVoiceMessageAction } from "@/actions/voice-actions";
import { NeuralMap, type RegionActivity } from "@/components/voice/neural-map";
import {
  TopLeftPanel,
  TopRightPanel,
  StatusRail,
  StatusPill,
  Subtitle,
  StatusStrip,
  type VoiceStatusMode,
} from "@/components/voice/hud-panels";
import type { VoiceDashboardData } from "@/lib/db/queries/voice";

const WAKE_PATTERN = /\bjarvis\b/i;
const MOTOR_PULSE_MS = 700;

function extractAfterWake(text: string): string {
  const match = text.match(WAKE_PATTERN);
  if (!match || match.index === undefined) return "";
  return text.slice(match.index + match[0].length).replace(/^[,.\s]+/, "");
}

export function VoiceModeClient({ data }: { data: VoiceDashboardData }) {
  // Mic mode is off by default (gotcha 6: privacy) — this page renders but
  // does nothing until the user explicitly clicks "Start listening".
  const [micOn, setMicOn] = useState(false);
  const [mode, setMode] = useState<VoiceStatusMode>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalDisplay, setFinalDisplay] = useState("");
  const [replyText, setReplyText] = useState("");
  const [motorPulse, setMotorPulse] = useState(false);
  // Computed post-mount only, so server/first-client render always agree
  // (avoids a hydration mismatch on the "unsupported browser" banner).
  const [browserSupport, setBrowserSupport] = useState({ voice: false, tts: false });

  const finalBufferRef = useRef("");
  const isRequestInFlightRef = useRef(false);
  const isPttHeldRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const modeRef = useRef<VoiceStatusMode>("idle");
  const motorPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // recognitionControlsRef breaks what would otherwise be a circular
  // dependency: the callbacks below need to pause/resume recognition, but
  // useSpeechRecognition itself needs those same callbacks as input. The
  // hook's pause/resume are stable (empty-dep useCallback) so this ref is
  // populated once and effectively never changes after mount.
  const recognitionControlsRef = useRef<{ pause: () => void; resume: () => void }>({
    pause: () => {},
    resume: () => {},
  });

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    // Deferred, not synchronous in the effect body, so server/first-client
    // render always agree (both show the "unsupported" banner briefly on a
    // supported browser too, for one frame, rather than risking a mismatch).
    const id = setTimeout(() => {
      setBrowserSupport({
        voice: !!(window.SpeechRecognition ?? window.webkitSpeechRecognition),
        tts: browserTts.isSupported(),
      });
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const enterListening = useCallback((seedText: string) => {
    finalBufferRef.current = seedText;
    setFinalDisplay(seedText);
    setInterimTranscript("");
    setMode("listening");
  }, []);

  const speakReply = useCallback((text: string) => {
    setReplyText(text);
    setMode("speaking");
    // Gotcha 2, the single most important detail here: pause recognition
    // before speaking or the mic hears JARVIS's own voice and re-triggers.
    recognitionControlsRef.current.pause();
    browserTts.speak(text, {
      onEnd: () => {
        recognitionControlsRef.current.resume();
        finalBufferRef.current = "";
        setFinalDisplay("");
        setInterimTranscript("");
        setReplyText("");
        setMode("idle");
      },
    });
  }, []);

  const submitUtterance = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setMode("idle");
        return;
      }
      if (isRequestInFlightRef.current) return; // gotcha 7: never fire a second call while one is in flight
      if (Date.now() < cooldownUntilRef.current) return;

      isRequestInFlightRef.current = true;
      setMode("thinking"); // PREFRONTAL fires for exactly this window — see regionActivity below
      recognitionControlsRef.current.pause();

      const result = await sendVoiceMessageAction(trimmed);
      isRequestInFlightRef.current = false;

      if (!result.rateLimited && !result.error) {
        // A real mentor_messages write just happened as part of that call
        // (runGeneralMentorChat inserts both turns) — MOTOR CORTEX's pulse
        // reflects that real event, timed to when we can confirm it occurred.
        setMotorPulse(true);
        if (motorPulseTimeoutRef.current) clearTimeout(motorPulseTimeoutRef.current);
        motorPulseTimeoutRef.current = setTimeout(() => setMotorPulse(false), MOTOR_PULSE_MS);
      }

      if (result.rateLimited) {
        cooldownUntilRef.current = Date.now() + 15_000;
        speakReply("Rate limited. One moment.");
      } else if (result.error) {
        speakReply("Sorry — something went wrong on my end.");
      } else {
        speakReply(result.reply ?? "…");
      }
    },
    [speakReply],
  );

  const handleFinalResult = useCallback(
    (text: string) => {
      const current = modeRef.current;
      if (current === "idle") {
        if (WAKE_PATTERN.test(text)) {
          const rest = extractAfterWake(text);
          enterListening(rest);
          if (rest && !isPttHeldRef.current) {
            void submitUtterance(rest);
          }
        }
        return;
      }
      if (current === "listening") {
        finalBufferRef.current = `${finalBufferRef.current} ${text}`.trim();
        setFinalDisplay(finalBufferRef.current);
        setInterimTranscript("");
        if (!isPttHeldRef.current) {
          void submitUtterance(finalBufferRef.current);
        }
      }
      // thinking/speaking: recognition is paused, so this shouldn't fire — ignored defensively anyway.
    },
    [enterListening, submitUtterance],
  );

  const handleInterimResult = useCallback((text: string) => {
    const current = modeRef.current;
    if (current === "idle" && WAKE_PATTERN.test(text)) {
      enterListening(extractAfterWake(text));
      return;
    }
    if (current === "listening") setInterimTranscript(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recognition = useSpeechRecognition({
    enabled: micOn,
    onFinalResult: handleFinalResult,
    onInterimResult: handleInterimResult,
  });

  useEffect(() => {
    recognitionControlsRef.current = { pause: recognition.pause, resume: recognition.resume };
  }, [recognition.pause, recognition.resume]);

  const micLevel = useMicAudioLevel(micOn && mode === "listening");
  const speakingEnvelope = useSyntheticEnvelope(mode === "speaking");

  // Every value below reads state the app already computes — no new Gemini
  // call anywhere in here. PREFRONTAL is bounded to exactly the
  // sendVoiceMessageAction promise above; HIPPOCAMPUS reflects the real,
  // server-computed data.moduleStatus.memory flag (same one the System
  // Status rail already shows); ASSOCIATION reflects that context assembly
  // (buildMentorContext) is unconditional in the mentor-chat path, a stable
  // fact about this codebase, not a per-request guess.
  const hasMemory = data.moduleStatus.memory;
  const regionActivity: RegionActivity = useMemo(() => {
    const listening = mode === "listening";
    const thinking = mode === "thinking";
    const speaking = mode === "speaking";
    return {
      sensory_cortex: listening ? Math.round(micLevel * 1000) / 10 : 0,
      language: speaking ? Math.round(Math.max(18, speakingEnvelope * 100) * 10) / 10 : 0,
      prefrontal: thinking ? 100 : 0,
      hippocampus: thinking && hasMemory ? 68 : 0,
      association: thinking ? 55 : 0,
      motor_cortex: motorPulse ? 100 : 0,
      concept_layer: 3.2,
      feature_layer: 2.4,
    };
  }, [mode, micLevel, speakingEnvelope, hasMemory, motorPulse]);

  // Push-to-talk: hold to talk, no wake word needed. Built first, per the
  // work order, as the simplest path and the one used to debug everything
  // else. Shared between the spacebar handler below (desktop) and the
  // on-screen hold-to-talk button (touch/mobile — no physical keyboard).
  // Also doubles as the barge-in trigger: starting PTT while JARVIS is
  // speaking cancels TTS immediately and starts listening — a real
  // voice-based barge-in isn't compatible with gotcha 2's hard
  // pause-recognition-during-speech rule (paused = literally can't hear the
  // user), so this is the reliable mechanism instead of a fragile one.
  const startPtt = useCallback(() => {
    if (!micOn) return;
    if (modeRef.current === "speaking") {
      browserTts.cancel();
      recognitionControlsRef.current.resume();
    }
    if (modeRef.current === "thinking") return; // don't interrupt a request already sent
    isPttHeldRef.current = true;
    enterListening("");
  }, [micOn, enterListening]);

  const endPtt = useCallback(() => {
    if (!isPttHeldRef.current) return;
    isPttHeldRef.current = false;
    const text = `${finalBufferRef.current} ${interimTranscript}`.trim();
    void submitUtterance(text);
  }, [interimTranscript, submitUtterance]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      startPtt();
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      endPtt();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startPtt, endPtt]);

  // Escape exits the page entirely.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      browserTts.cancel();
      window.location.href = "/";
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    return () => browserTts.cancel();
  }, []);

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-black">
      <div className="absolute inset-0">
        <NeuralMap activity={regionActivity} />
      </div>

      {/* Corner HUD panels — supplementary context, not core to the voice
          interaction, and there's no room for three dense panels on a
          phone-width screen without them overlapping each other and the
          neural map's own labels. Desktop/tablet only. */}
      <div className="pointer-events-none absolute left-6 top-6 z-10 hidden 2xl:block">
        <TopLeftPanel data={data.last7Days} />
      </div>
      <div className="pointer-events-none absolute right-6 top-20 z-10 hidden 2xl:block">
        <TopRightPanel data={data.today} />
      </div>
      <div className="pointer-events-none absolute right-6 top-1/2 z-10 hidden -translate-y-1/2 2xl:block">
        <StatusRail
          moduleStatus={data.moduleStatus}
          geminiBudget={data.geminiBudget}
          voiceSupported={browserSupport.voice}
          ttsSupported={browserSupport.tts}
        />
      </div>

      <div className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2">
        <StatusPill mode={mode} />
      </div>

      {!browserSupport.voice ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 px-6 text-center text-xs text-warn">
          This browser doesn&apos;t support speech recognition (Chrome-based browsers only) — push-to-talk and wake
          word won&apos;t work here.
        </div>
      ) : null}

      {/* Bottom control zone — one flex column so the mobile hold-to-talk row
          stacks cleanly above the status strip instead of guessing fixed
          pixel offsets per element. */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
        {/* The most functionally important text on screen — sized to read across a room. */}
        <div className="pointer-events-none w-full">
          <Subtitle finalText={finalDisplay} interimText={interimTranscript} replyText={replyText} />
        </div>

        {/* Touch controls — spacebar covers push-to-talk on desktop, so this
            row only matters on mobile, which has no physical keyboard. */}
        <div className="flex items-center gap-5 2xl:hidden">
          <button
            onClick={() => setMicOn((v) => !v)}
            aria-pressed={micOn}
            aria-label={micOn ? "Stop listening" : "Start listening"}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border transition-colors",
              micOn ? "border-danger/50 bg-danger/10 text-danger" : "border-white/20 bg-white/5 text-white/70",
            )}
          >
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>
          <button
            disabled={!micOn}
            aria-label="Hold to talk"
            onPointerDown={(e) => {
              e.preventDefault();
              startPtt();
            }}
            onPointerUp={endPtt}
            onPointerCancel={endPtt}
            onPointerLeave={() => {
              if (isPttHeldRef.current) endPtt();
            }}
            className={cn(
              "flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border-2 text-[10px] font-semibold uppercase tracking-wide transition-colors",
              !micOn
                ? "border-white/10 bg-white/5 text-white/30"
                : mode === "listening"
                  ? "border-brand bg-brand/20 text-brand"
                  : "border-white/30 bg-white/10 text-white/80 active:bg-white/20",
            )}
          >
            Hold
          </button>
        </div>

        <div className="pointer-events-none">
          <StatusStrip micActive={micOn} />
        </div>
      </div>

      {/* Desktop/tablet: floating toggle + spacebar hint. Mobile uses the
          touch controls in the bottom zone above instead. */}
      <div className="absolute right-6 top-[calc(50%+8rem)] z-20 hidden flex-col items-end gap-2 2xl:flex">
        <button
          onClick={() => setMicOn((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
            micOn ? "border-danger/50 bg-danger/10 text-danger" : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10",
          )}
          aria-pressed={micOn}
        >
          {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
          {micOn ? "Listening — click to stop" : "Start listening"}
        </button>
        <p className="max-w-52 text-right text-[10px] leading-tight text-white/40">
          Hold space to talk any time. The mic stays on and is sent to Chrome for recognition while listening is on —
          click to stop it whenever you want.
        </p>
      </div>

      <Link
        href="/"
        aria-label="Exit voice mode"
        className="absolute right-6 top-6 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </Link>
    </div>
  );
}
