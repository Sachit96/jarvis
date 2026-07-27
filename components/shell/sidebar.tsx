"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, MENTOR_NAV_ITEM } from "@/lib/nav-items";

export function Sidebar() {
  const pathname = usePathname();
  const items = [...NAV_ITEMS, MENTOR_NAV_ITEM];

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-sidebar-border md:bg-sidebar md:p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="font-mono text-lg font-semibold tracking-widest text-brand">
          JARVIS
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const moduleSegment = `/${item.href.split("/")[1]}`;
          const isActive = pathname.startsWith(moduleSegment);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-brand"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={isActive ? 2.25 : 1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
