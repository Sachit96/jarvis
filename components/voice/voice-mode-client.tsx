"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useSpeechRecognition } from "@/lib/voice/use-speech-recognition";
import { useMicAudioLevel } from "@/lib/voice/use-mic-audio-level";
import { useSyntheticEnvelope } from "@/lib/voice/use-synthetic-envelope";
import { browserTts } from "@/lib/voice/tts";
import { interpretConfirmation, REPROMPT } from "@/lib/voice/confirmation";
import { sendVoiceMessageAction } from "@/actions/voice-actions";
import { BrainGraph3D, type BrainGraphHandle } from "@/components/voice/brain-graph-3d";
import { BrainSearch } from "@/components/voice/brain-search";
import { JarvisTelemetry } from "@/components/voice/jarvis-telemetry";
import { VoiceControlBar } from "@/components/voice/voice-control-bar";
import { buildBrainGraph, colorForCategory, searchBrain } from "@/lib/voice/brain-graph";
import {
  StatusPill,
  ActivityStrip,
  type VoiceStatusMode,
  type VoiceTraceEntry,
} from "@/components/voice/hud-panels";
import type { VoiceDashboardData } from "@/lib/db/queries/voice";

const WAKE_PATTERN = /\bjarvis\b/i;

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

  // The knowledge graph, built once from the memory entries the server sent.
  // Rebuilding it per render would restart the force simulation and make the
  // whole network lurch on every keystroke and every status change.
  const graph = useMemo(() => buildBrainGraph(data.brain), [data.brain]);
  const [search, setSearch] = useState("");
  const litNodes = useMemo(() => searchBrain(graph, search), [graph, search]);
  // State rather than a ref: the React Compiler rejects mutating a ref from
  // inside a memoized callback, and the handle genuinely is a value this
  // component renders against once the 3D chunk has loaded.
  const [brain, setBrain] = useState<BrainGraphHandle | null>(null);

  const legend = useMemo(
    () => graph.categories.map((c) => ({ ...c, color: colorForCategory(c.id) })),
    [graph],
  );

  const [trace, setTrace] = useState<VoiceTraceEntry[]>([]);
  // Held while JARVIS waits for a spoken yes. The next utterance is read as
  // an answer to this rather than as a new request.
  const [pendingConfirmation, setPendingConfirmation] =
    useState<{ toolName: string; summary: string; args: Record<string, unknown> } | null>(null);
  // Computed post-mount only, so server/first-client render always agree
  // (avoids a hydration mismatch on the "unsupported browser" banner).
  const [browserSupport, setBrowserSupport] = useState({ voice: false, tts: false });

  const finalBufferRef = useRef("");
  const isRequestInFlightRef = useRef(false);
  const isPttHeldRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const modeRef = useRef<VoiceStatusMode>("idle");
  // submitUtterance is a stable callback, so it cannot close over the
  // pendingConfirmation state directly without going stale between turns.
  const pendingConfirmationRef = useRef<typeof pendingConfirmation>(null);
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
    pendingConfirmationRef.current = pendingConfirmation;
  }, [pendingConfirmation]);

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

  /**
   * `after` is the state to land in once JARVIS stops talking. It defaults to
   * idle, but a confirmation question has to land in
   * waiting_for_confirmation: the HUD declared that state and nothing ever
   * set it, so asking "shall I go ahead?" looked identical to any other
   * reply, with no visible sign that the turn was blocked on an answer.
   */
  // Derived rather than stored. "Transcribing" is precisely "listening while
  // words are arriving", so computing it from the two facts that already
  // exist avoids a second state machine racing the recognition events — and
  // avoids the dead-state problem that waiting_for_confirmation had.
  const displayMode: VoiceStatusMode =
    mode === "listening" && interimTranscript.trim() ? "transcribing" : mode;

  const speakReply = useCallback((text: string, after: VoiceStatusMode = "idle") => {
    setReplyText(text);
    setMode("speaking");
    // If the reply names a cluster, fly there. Conservative by design —
    // focusTargetFor returns null rather than guessing, because a wrong
    // fly-to is more disorienting than none.
    brain?.focusOn(text);
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
        setMode(after);
      },
    });
  }, [brain]);

  const submitUtterance = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setMode("idle");
        return;
      }
      if (isRequestInFlightRef.current) return; // gotcha 7: never fire a second call while one is in flight
      if (Date.now() < cooldownUntilRef.current) return;

      const pending = pendingConfirmationRef.current;

      // While a high-risk action awaits approval, this utterance is an
      // answer to that question — not a new instruction. Parsing it as a
      // fresh request is how "no, cancel" would get sent to the model as
      // something to act on.
      if (pending) {
        const intent = interpretConfirmation(trimmed);
        if (intent === "ambiguous") {
          // Deliberately does NOT fall through to treating it as a new
          // request: an unclear answer to "shall I delete this?" must
          // re-ask, never proceed and never silently drop the pending call.
          // Still blocked on the user: an unclear answer must not read as
          // though the turn moved on.
          speakReply(REPROMPT, "waiting_for_confirmation");
          return;
        }
        if (intent === "declined") {
          setPendingConfirmation(null);
          setTrace([]);
          speakReply("Cancelled. Nothing was changed.");
          return;
        }
        // Confirmed. The approved arguments are replayed from the pending
        // record, not re-derived from this utterance.
        isRequestInFlightRef.current = true;
        setMode("executing");
        recognitionControlsRef.current.pause();
        setPendingConfirmation(null);

        const approved = await sendVoiceMessageAction(pending.summary, {
          toolName: pending.toolName,
          args: pending.args,
        });
        isRequestInFlightRef.current = false;
        if (approved.trace) setTrace(approved.trace);
        if (approved.error) {
          setMode("error");
          speakReply("Sorry — that didn't go through.");
        } else {
          speakReply(approved.reply ?? "Done.");
        }
        return;
      }

      isRequestInFlightRef.current = true;
      setMode("thinking");
      recognitionControlsRef.current.pause();

      const result = await sendVoiceMessageAction(trimmed);
      isRequestInFlightRef.current = false;

      if (!result.rateLimited && !result.error) {
      }

      if (result.trace) setTrace(result.trace);

      if (result.rateLimited) {
        cooldownUntilRef.current = Date.now() + 15_000;
        speakReply("Rate limited. One moment.");
      } else if (result.error) {
        setMode("error");
        speakReply("Sorry — something went wrong on my end.");
      } else if (result.pendingConfirmation) {
        // Spoken aloud so the user can answer without looking at the screen,
        // which is the whole point of a voice interface.
        setPendingConfirmation(result.pendingConfirmation);
        speakReply(`${result.pendingConfirmation.summary}. Shall I go ahead?`, "waiting_for_confirmation");
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

  // One level for the telemetry ring: the mic while listening, the speech
  // envelope while speaking. Both are real signals the page already has, so
  // a moving gauge always means sound is genuinely moving through it.
  const telemetryLevel =
    mode === "speaking" ? speakingEnvelope : mode === "listening" ? micLevel : 0;


  // Push-to-talk: hold to talk, no wake word needed. Built first, per the
  // work order, as the simplest path and the one used to debug everything
  // else. Shared between the spacebar handler below (desktop) and the
  // on-screen hold-to-talk button (touch/mobile — no physical keyboard).
  // Also doubles as the barge-in trigger: starting PTT while JARVIS is
  // speaking cancels TTS immediately and starts listening — a real
  // voice-based barge-in isn't compatible with gotcha 2's hard
  // pause-recognition-during-speech rule (paused = literally can't hear the
  // user), so this is the reliable mechanism instead of a fragile one.
  /**
   * A quick prompt.
   *
   * Goes through submitUtterance, the same path a spoken sentence takes, so
   * the in-flight guard, the cooldown and the confirmation interception all
   * apply. A separate send path would be a second place for those rules to
   * be forgotten.
   *
   * The text is shown as the final transcript first, so the prompt you
   * pressed is visible while the answer is being worked out.
   */
  const handleQuickPrompt = useCallback(
    (text: string) => {
      finalBufferRef.current = text;
      setFinalDisplay(text);
      setInterimTranscript("");
      void submitUtterance(text);
    },
    [submitUtterance],
  );

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
      {/* The space the network hangs in: deep purple bleeding out of black,
          with a fine dust so the depth reads before a single node loads. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,color-mix(in_oklab,var(--brand)_18%,transparent),transparent_65%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle,rgb(255_255_255/0.55)_0.5px,transparent_0.5px)] [background-size:64px_64px]" />

      <div className="absolute inset-0">
        <BrainGraph3D
          entries={data.brain}
          active={mode === "thinking" || mode === "executing" || mode === "speaking"}
          search={search}
          onReady={setBrain}
        />
      </div>

      <div className="pointer-events-auto absolute left-4 top-4 z-10 hidden sm:block">
        <BrainSearch
          value={search}
          onChange={setSearch}
          categories={legend}
          matchCount={search ? litNodes.size : 0}
        />
      </div>

      {/* Only once a turn has actually run something, so the HUD stays clean
          until there is something real to report. */}
      <div className="pointer-events-none absolute left-4 top-[19rem] z-10 hidden 2xl:block">
        <ActivityStrip entries={trace} />
      </div>

      <div className="pointer-events-none absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
        <JarvisTelemetry
          mode={displayMode}
          level={telemetryLevel}
          model={data.geminiBudget.model}
          budget={{ used: data.geminiBudget.used, limit: data.geminiBudget.limit }}
        />
      </div>

      <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
        <StatusPill mode={displayMode} />
      </div>

      {!browserSupport.voice ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 px-6 text-center text-xs text-warn">
          This browser doesn&apos;t support speech recognition (Chrome-based browsers only) — push-to-talk and wake
          word won&apos;t work here.
        </div>
      ) : recognition.error ? (
        <div
          role="alert"
          className="absolute inset-x-0 top-16 z-10 mx-auto max-w-md rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-center text-xs text-danger"
        >
          {recognition.error}
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
        <VoiceControlBar
          micOn={micOn}
          onToggleMic={() => setMicOn((v) => !v)}
          onQuickPrompt={handleQuickPrompt}
          listening={mode === "listening"}
          disabled={!browserSupport.voice}
          finalText={finalDisplay}
          interimText={interimTranscript}
          replyText={replyText}
        />
      </div>

      <Link
        href="/"
        aria-label="Exit voice mode"
        className="absolute right-4 top-4 z-20 flex h-10 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:border-white/30 hover:bg-white/15 hover:text-white lg:right-6"
      >
        <X className="h-4 w-4" />
        <span className="hidden sm:inline">Exit</span>
      </Link>
    </div>
  );
}
