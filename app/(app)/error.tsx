"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/shared/error-state";

/**
 * Route-level error boundary for every page under (app).
 *
 * Next's error.tsx convention catches a failed Server Component render — a
 * thrown fetch, a bug in page code — anywhere in this segment and its
 * children, and renders this instead of a raw stack trace.
 *
 * It no longer prints `error.message`. A thrown Supabase error's message
 * carries column names, relation names and sometimes the request URL, and
 * this component renders in the browser; the digest is the handle for
 * finding the real error in the server logs, and that is all the user needs.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Client-side only — server errors are already in the function logs.
    // This keeps a client-triggered render error from being silent.
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <ErrorState
        title="This page could not load"
        description="The data behind it did not come back. Every other module is unaffected."
        digest={error.digest}
        onRetry={reset}
      />
      <Link href="/" className="text-body font-medium text-brand hover:underline">
        Back to Home
      </Link>
    </div>
  );
}
