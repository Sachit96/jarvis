import Link from "next/link";

/**
 * Root-level 404 — same split as app/error.tsx / app/(app)/not-found.tsx:
 * catches a bad URL outside the (app) route group (an unknown top-level
 * path, or under /voice), where the (app) shell's card-based 404 would
 * look wrong. No not-found.tsx existed anywhere before this (Cleanup and
 * close-out work order, Phase 3) — a bad URL fell through to Next.js's
 * bare default page.
 */
export default function RootNotFound() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-black text-white">
      <p className="text-sm text-white/70">Page not found.</p>
      <Link href="/" className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-wide text-white/80 hover:bg-white/5">
        Go home
      </Link>
    </div>
  );
}
