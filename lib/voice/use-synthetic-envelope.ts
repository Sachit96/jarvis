"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A fake but organic-looking amplitude envelope for the "speaking" state.
 * speechSynthesis exposes no analysable audio output — there's nothing real
 * to drive the orb from — so this is a smoothed sine + noise combination
 * instead. Only advances while `enabled`; returns 0 otherwise without ever
 * setState-ing synchronously inside the effect body (the rAF callback is
 * the async boundary that makes setState here legitimate).
 */
export function useSyntheticEnvelope(enabled: boolean): number {
  const [rawLevel, setRawLevel] = useState(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      phaseRef.current = 0;
      return;
    }

    let raf: number;
    function tick() {
      phaseRef.current += 0.18;
      const base = 0.5 + 0.35 * Math.sin(phaseRef.current);
      const flutter = 0.15 * Math.sin(phaseRef.current * 3.7);
      const jitter = (Math.random() - 0.5) * 0.15;
      setRawLevel(Math.max(0, Math.min(1, base + flutter + jitter)));
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  return enabled ? rawLevel : 0;
}
