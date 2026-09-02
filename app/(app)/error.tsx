"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Route-level error boundary for every page under (app) — Next.js's
 * error.tsx convention catches a failed Server Component render (a
 * thrown fetch, a bug in page code) anywhere in this segment and its
 * children, and renders this instead of the framework's raw stack trace.
 * No error.tsx existed anywhere in the app before this (Session 2, Phase
 * 4) — a single one here covers every route under (app) rather than
 * needing one per page.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Client-side only — server-side errors are already in Netlify's
    // function logs. This just makes sure a client-triggered error (e.g.
    // a Server Action's response causing a render error) isn't silent.
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {error.message || "This page hit an unexpected error."}
        </p>
        {error.digest ? <p className="mt-1 font-mono text-caption text-muted-foreground/60">digest: {error.digest}</p> : null}
        <div className="mt-4 flex justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={reset} className="gap-1.5">
            <RotateCw className="h-3.5 w-3.5" /> Try again
          </Button>
          <Link href="/" className="inline-flex items-center rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80">
            Go home
          </Link>
        </div>
      </Card>
    </div>
  );
}
