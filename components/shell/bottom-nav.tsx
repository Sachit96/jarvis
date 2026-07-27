"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-border bg-card/95 backdrop-blur md:hidden">
      {NAV_ITEMS.map((item) => {
        const moduleSegment = `/${item.href.split("/")[1]}`;
        const isActive = pathname.startsWith(moduleSegment);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors",
              isActive
                ? "text-brand"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon
              className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_var(--brand)]")}
              strokeWidth={isActive ? 2.25 : 1.75}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
