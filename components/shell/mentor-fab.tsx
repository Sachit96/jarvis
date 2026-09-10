"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

/**
 * Mentor is cross-cutting, not a peer module — reachable via a distinct
 * floating glowing button on mobile rather than a 6th bottom-nav tab.
 * Hidden on desktop, where it folds into the sidebar instead.
 *
 * And hidden on Mentor itself. A shortcut to the page you are already on is
 * noise at the best of times; here it sat on top of the console's send
 * button, which is the one control that page exists for.
 */
export function MentorFab() {
  const pathname = usePathname();
  if (pathname === "/mentor" || pathname.startsWith("/mentor/")) return null;

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
