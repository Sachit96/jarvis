"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_ITEMS } from "@/lib/nav-items";
import { signOutAction } from "@/actions/auth-actions";

const COLLAPSE_KEY = "jarvis-sidebar-collapsed";

// Collapsed state lives in localStorage, not React state — useSyncExternalStore
// reads it directly (SSR-safe via getServerSnapshot) and this tiny pub-sub
// re-renders subscribers when the toggle writes a new value, without ever
// needing an effect+setState pair just to sync from an external source.
const listeners = new Set<() => void>();
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
function getSnapshot() {
  return localStorage.getItem(COLLAPSE_KEY) === "true";
}
function getServerSnapshot() {
  return false;
}
function setCollapsedPreference(value: boolean) {
  localStorage.setItem(COLLAPSE_KEY, String(value));
  listeners.forEach((l) => l());
}

export function Sidebar({ userEmail }: { userEmail: string | undefined }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    setCollapsedPreference(!collapsed);
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col bg-sidebar transition-[width] duration-200 ease-[var(--ease-jarvis)] md:flex",
        collapsed ? "md:w-[72px]" : "md:w-60",
      )}
    >
      <div className={cn("flex h-14 shrink-0 items-center px-4", collapsed && "justify-center px-0")}>
        {!collapsed ? (
          <span className="font-mono text-heading font-semibold tracking-widest text-brand">JARVIS</span>
        ) : (
          <span className="font-mono text-heading font-semibold text-brand">J</span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
        {SIDEBAR_ITEMS.map((item) => {
          const moduleSegment = `/${item.href.split("/")[1]}`;
          const isActive = pathname.startsWith(moduleSegment);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-body transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon
                className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-brand")}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-body text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
          )}
          {!collapsed ? "Collapse" : null}
        </button>

        {!collapsed ? (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
            <span className="min-w-0 truncate font-mono text-caption text-sidebar-foreground/60">{userEmail}</span>
            <form action={signOutAction}>
              <button type="submit" className="shrink-0 text-caption text-sidebar-foreground/60 hover:text-sidebar-foreground">
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
