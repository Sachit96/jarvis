"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What a module shows when its data could not be loaded.
 *
 * Says which surface failed and offers the one action that helps, because
 * "Something went wrong" on a full-page background tells the user nothing
 * about whether the rest of the app still works.
 *
 * The underlying error is NOT rendered. A Supabase failure message can carry
 * a connection string or a column list; the digest is enough to find it in
 * the server logs, and everything else stays server-side.
 */
export function ErrorState({
  title = "This section could not load",
  description,
  digest,
  onRetry,
}: {
  title?: string;
  description?: string;
  /** Next's error digest — the handle for finding the real error in the logs. */
  digest?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="relative flex size-11 items-center justify-center rounded-full bg-danger/10 text-danger">
        <span className="absolute inset-[-5px] rounded-full border border-danger/25" />
        <TriangleAlert className="size-[18px]" strokeWidth={1.75} />
      </span>

      <div className="space-y-1.5">
        <p className="eyebrow text-danger">{title}</p>
        <p className="mx-auto max-w-[40ch] text-body text-foreground-tertiary">
          {description ??
            "The data behind this page did not come back. Everything else in JARVIS is unaffected."}
        </p>
      </div>

      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      ) : null}

      {digest ? <p className="tabular text-caption text-foreground-tertiary/60">Reference {digest}</p> : null}
    </div>
  );
}
