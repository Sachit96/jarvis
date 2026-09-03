import Link from "next/link";
import { Compass } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Route-level 404 for every page under (app) — same reasoning and split as
 * app/(app)/error.tsx / app/not-found.tsx: this covers both a bad URL
 * typed directly under (app), and a deliberate notFound() call from a
 * page (e.g. app/(app)/business/clients/[id]/page.tsx and .../pipeline/
 * [id]/page.tsx, added this session, calling notFound() for an unknown
 * id — those previously fell through to Next.js's bare default "This page
 * could not be found" screen since nothing in this app defined one).
 */
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <Compass className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Page not found</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Whatever you were looking for isn&apos;t here — it may have been moved, deleted, or the link was wrong.
        </p>
        <div className="mt-4 flex justify-center">
          <Link href="/" className="inline-flex items-center rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80">
            Go home
          </Link>
        </div>
      </Card>
    </div>
  );
}
