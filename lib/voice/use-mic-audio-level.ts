"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Real mic amplitude, 0-1, updated every frame — only meaningful while
 * `enabled` (i.e. while actually listening). Never runs while JARVIS is
 * speaking — see lib/voice/use-synthetic-envelope.ts for that state, since
 * there's no way to analyse speechSynthesis output (gotcha: TTS gives you
 * no analysable audio stream).
 */
export function useMicAudioLevel(enabled: boolean): number {
  const [rawLevel, setRawLevel] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let raf: number | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        function tick() {
          if (cancelled) return;
          analyser!.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length;
          setRawLevel(Math.min(1, avg / 110));
          raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);
      } catch (err) {
        console.error("[voice] mic access failed:", err);
      }
    }
    void start();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      audioCtx?.close();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled]);

  return enabled ? rawLevel : 0;
}
