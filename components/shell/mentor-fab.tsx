import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * Mentor is cross-cutting, not a peer module — reachable via a distinct
 * floating glowing button on mobile rather than a 6th bottom-nav tab.
 * Hidden on desktop, where it folds into the sidebar instead.
 */
export function MentorFab() {
  return (
    <Link
      href="/mentor"
      aria-label="AI Mentor"
      className="glow-brand fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-primary-foreground md:hidden"
    >
      <Sparkles className="h-6 w-6" strokeWidth={2} />
    </Link>
  );
}
