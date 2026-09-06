"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseSpeechRecognitionOptions {
  /** Whether continuous listening should be running at all right now. */
  enabled: boolean;
  onFinalResult: (text: string) => void;
  onInterimResult?: (text: string) => void;
}

interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  /** Human-readable guidance for the errors a user can actually do something
   * about (permission denied, no mic hardware) — found live (2026-09-06
   * audit): every non-transient recognition error was console.error-only,
   * so denying the mic prompt left the toggle silently non-functional with
   * no on-screen explanation. Cleared automatically on the next successful
   * start. */
  error: string | null;
  /** Deliberately stop — e.g. right before speechSynthesis.speak() (gotcha 2: TTS feeding back into the mic). */
  pause: () => void;
  /** Resume after a deliberate pause — e.g. an utterance's onend. */
  resume: () => void;
}

function hasSpeechRecognition() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

const ERROR_MESSAGE: Record<string, string> = {
  "not-allowed": "Microphone access was denied. Allow the microphone for this site in your browser's settings, then reload.",
  "service-not-allowed": "Microphone access was denied. Allow the microphone for this site in your browser's settings, then reload.",
  "audio-capture": "No microphone was found. Check that one is connected and not in use by another app.",
  network: "Speech recognition needs a network connection — check yours and try again.",
};

/**
 * Wraps webkitSpeechRecognition with the two things that make continuous
 * listening actually usable instead of silently breaking:
 *
 * 1. Chrome ends `continuous` recognition after a stretch of silence
 *    regardless of the flag. onend restarts it unless the stop was
 *    deliberate (see pause/resume) — without this, wake-word listening
 *    dies after ~30s and just looks broken.
 * 2. Interim results are surfaced separately from final ones — only a
 *    final result is ever handed to the caller, so a single sentence
 *    can't fire the caller's handler (and therefore a Gemini call)
 *    multiple times.
 */
export function useSpeechRecognition({
  enabled,
  onFinalResult,
  onInterimResult,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const [isSupported] = useState(hasSpeechRecognition);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const deliberateStopRef = useRef(true);
  const enabledRef = useRef(enabled);

  const onFinalResultRef = useRef(onFinalResult);
  const onInterimResultRef = useRef(onInterimResult);

  // Keep the latest callbacks/enabled flag available to the recognition
  // instance's own event handlers without re-creating it on every render —
  // assigned post-render (effect), not during render.
  useEffect(() => {
    enabledRef.current = enabled;
    onFinalResultRef.current = onFinalResult;
    onInterimResultRef.current = onInterimResult;
  });

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const trimmed = transcript.trim();
          if (trimmed) onFinalResultRef.current(trimmed);
        } else {
          interim += transcript;
        }
      }
      if (interim.trim()) onInterimResultRef.current?.(interim.trim());
    };

    recognition.onend = () => {
      setIsListening(false);
      if (!deliberateStopRef.current && enabledRef.current) {
        try {
          recognition.start();
        } catch {
          // Already starting — the browser will fire another onend shortly.
        }
      }
    };

    recognition.onerror = (event) => {
      // "no-speech" and "aborted" happen constantly on an always-on mic and
      // are not real problems — onend follows immediately and restarts.
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("[voice] speech recognition error:", event.error);
        setError(ERROR_MESSAGE[event.error] ?? "Something went wrong with the microphone — try again.");
      }
    };

    recognitionRef.current = recognition;
    return () => {
      deliberateStopRef.current = true;
      recognition.onstart = null;
      recognition.onend = null;
      recognition.stop();
    };
  }, []);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (enabled) {
      deliberateStopRef.current = false;
      try {
        recognition.start();
      } catch {
        // Already running.
      }
    } else {
      deliberateStopRef.current = true;
      recognition.stop();
    }
  }, [enabled]);

  const pause = useCallback(() => {
    deliberateStopRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  const resume = useCallback(() => {
    if (!enabledRef.current) return;
    deliberateStopRef.current = false;
    try {
      recognitionRef.current?.start();
    } catch {
      // Already running.
    }
  }, []);

  return { isSupported, isListening, error, pause, resume };
}
