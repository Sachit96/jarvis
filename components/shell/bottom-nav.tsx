"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { activeNavHref, NAV_ITEMS } from "@/lib/nav-items";

export function BottomNav() {
  const pathname = usePathname();

  const activeHref = activeNavHref(pathname, NAV_ITEMS);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-white/[0.08] bg-black/80 backdrop-blur-xl md:hidden">
      {NAV_ITEMS.map((item) => {
        const isActive = activeHref === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 text-caption transition-colors",
              isActive ? "text-white" : "text-foreground-tertiary hover:text-white",
            )}
          >
            {/* Same indicator language as the sidebar's leading bar, rotated
                to the top edge — one active-state idea, not two. */}
            {isActive ? (
              <span
                aria-hidden
                className="gradient-brand absolute inset-x-5 top-0 h-[2px] rounded-full shadow-[0_0_12px_0_color-mix(in_oklab,var(--brand)_60%,transparent)]"
              />
            ) : null}
            <Icon className="size-5" strokeWidth={isActive ? 2.25 : 1.75} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
