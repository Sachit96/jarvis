"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ModuleTab } from "@/lib/nav-items";

/**
 * In-module sub-navigation (Overview / Transactions / Accounts / …).
 *
 * A segmented glass control rather than the underlined tab row it was.
 * Underlined tabs are the single most generic component in a dashboard, and
 * this row appears on every module page in the app — so it was doing more
 * than anything else to make each module look like a different, ordinary
 * admin screen. The capsule matches the command bar above it, which is what
 * makes a module read as part of the same system.
 *
 * The scroll container keeps its negative margin so the row can bleed to the
 * screen edge on a phone: seven finance tabs do not fit, and a control the
 * user can't tell is scrollable is worse than one that visibly runs off.
 */
export function ModuleTabs({ tabs }: { tabs: ModuleTab[] }) {
  const pathname = usePathname();

  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <nav className="surface inline-flex w-max items-center gap-1 rounded-full p-1">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] whitespace-nowrap transition-colors duration-200 ease-[var(--ease-jarvis)]",
                // Tap target: the pill itself is ~32px, so the row is padded
                // out to 44px with a pseudo-element rather than by making
                // every capsule tall enough to look like a button bar.
                "after:absolute after:-inset-y-1.5 after:inset-x-0",
                isActive
                  ? "bg-[color-mix(in_oklab,var(--brand)_26%,transparent)] font-medium text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.12)]"
                  : "text-foreground-tertiary hover:bg-white/[0.05] hover:text-white",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
