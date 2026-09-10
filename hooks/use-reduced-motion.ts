"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Whether the viewer has asked for reduced motion.
 *
 * CSS animations already honour the preference through the
 * `@media (prefers-reduced-motion: reduce)` block in globals.css, but
 * recharts animates in JavaScript and never consults it — so every chart
 * in the app kept sweeping its series in regardless of the setting.
 *
 * `getServerSnapshot` returns false so the server and the first client
 * render agree; the real value arrives on the first store read after mount,
 * which is a state change rather than a hydration mismatch.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
