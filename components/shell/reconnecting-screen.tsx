"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const RETRY_DELAY_MS = 2500;

/**
 * Shown instead of the app shell when the automatic single-account sign-in
 * hasn't produced a session yet (see lib/supabase/middleware.ts) — a
 * transient Supabase Auth hiccup, not a real error state or empty data.
 * Auto-retries by refreshing the current route; middleware re-attempts the
 * sign-in on every request, so this resolves itself as soon as auth recovers.
 */
export function ReconnectingScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.refresh(), RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
        <p className="text-body text-muted-foreground">Reconnecting…</p>
      </div>
    </div>
  );
}
