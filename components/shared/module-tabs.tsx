"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ModuleTab } from "@/lib/nav-items";

export function ModuleTabs({ tabs }: { tabs: ModuleTab[] }) {
  const pathname = usePathname();

  return (
    <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              // relative + after:-inset-y-1.5 — real sub-navigation
              // (Dashboard/Pipeline/Clients/... on every domain page),
              // ~38px tall from py-2 alone; closed to 44px+ the same way
              // as the sidebar's own nav items (Cleanup work order
              // follow-up, tap targets).
              "relative shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors after:absolute after:-inset-y-1.5",
              isActive
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
