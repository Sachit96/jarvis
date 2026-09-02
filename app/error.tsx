"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Root-level error boundary — catches anything outside the (app) route
 * group, chiefly /voice (a standalone route, not under (app), so
 * app/(app)/error.tsx never sees its errors). Deliberately plain/dark to
 * match voice mode's own full-screen black aesthetic rather than the
 * (app) shell's card-based error screen, which would look wrong here.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[root error boundary]", error);
  }, [error]);

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-black text-white">
      <p className="text-sm text-white/70">{error.message || "Something went wrong."}</p>
      <div className="flex gap-3">
        <button onClick={reset} className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-wide text-white/80 hover:bg-white/5">
          Try again
        </button>
        <Link href="/" className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-wide text-white/80 hover:bg-white/5">
          Go home
        </Link>
      </div>
    </div>
  );
}
