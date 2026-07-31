"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDEBAR_ITEMS } from "@/lib/nav-items";
import { categoryForHref, CATEGORY_TEXT_CLASS } from "@/lib/category-colors";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { user, brand } from "@/lib/user";

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

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [logoFailed, setLogoFailed] = useState(false);
  const logoRef = useRef<HTMLImageElement>(null);

  // The <img> starts loading from the server-rendered HTML before React hydrates.
  // On localhost a 404 can resolve fast enough that its error event fires and is
  // missed — no listener is attached yet — so this catches that on mount instead
  // of relying on onError alone (which still covers a slower failure later).
  useEffect(() => {
    const img = logoRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setLogoFailed(true);
    }
  }, []);

  function toggle() {
    setCollapsedPreference(!collapsed);
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col bg-sidebar transition-[width] duration-200 ease-[var(--ease-jarvis)] md:flex",
        collapsed ? "md:w-[72px]" : "md:w-64",
      )}
    >
      {/* Workspace block — static (single-workspace app), styled like a switcher.
          The logo image is a full lockup (icon + wordmark), so it only replaces
          the text/icon combo when expanded — collapsed to 72px there's no room
          for it, so that state keeps the plain icon. Falls back to the original
          text lockup if the image file isn't there yet. */}
      <div className="shrink-0 p-3">
        {!collapsed && !logoFailed ? (
          <img
            ref={logoRef}
            src={brand.logo}
            alt="JARVIS — On Radar"
            className="w-full rounded-xl"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-border",
              collapsed && "justify-center px-0",
            )}
          >
            <span className="bg-gradient-brand flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-[0_0_16px_-2px_var(--brand)]">
              <Sparkles className="h-4 w-4" strokeWidth={2.25} />
            </span>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-body font-semibold tracking-wide text-sidebar-foreground">JARVIS</p>
                <p className="truncate text-caption text-muted-foreground">Personal OS</p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
        {SIDEBAR_ITEMS.map((item) => {
          const moduleSegment = `/${item.href.split("/")[1]}`;
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(moduleSegment);
          const Icon = item.icon;
          const category = categoryForHref(item.href);
          const iconColorClass = category ? CATEGORY_TEXT_CLASS[category] : "text-brand";
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
                className={cn("h-[18px] w-[18px] shrink-0", isActive && iconColorClass)}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
      </nav>

      {/* Profile block — single-user app, so this is a static identity strip
          rather than a real account switcher. No email is shown since
          there's no user/session record to source one from. */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className={cn("flex items-center gap-2.5 rounded-xl px-1 py-1.5", collapsed && "justify-center px-0")}>
          <Avatar className="after:border-white/10">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="bg-gradient-brand font-semibold text-white">{user.initial}</AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-caption font-medium text-sidebar-foreground">{user.name}</p>
                <p className="truncate text-caption text-muted-foreground">{user.workspace}</p>
              </div>
              <Link
                href="/settings"
                aria-label="Settings"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <SettingsIcon className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </>
          ) : null}
        </div>

        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-body text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
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
      </div>
    </aside>
  );
}
