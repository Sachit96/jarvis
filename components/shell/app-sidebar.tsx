"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings as SettingsIcon, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SIDEBAR_GROUPS } from "@/lib/nav-items";
import { categoryForHref, CATEGORY_TEXT_CLASS } from "@/lib/category-colors";
import { cn } from "@/lib/utils";
import { brand, user } from "@/lib/user";

/**
 * A nav row is active for its whole module, not just its exact href —
 * /finance/budgets should still light "Finance" up. Home is the exception,
 * since every path starts with "/".
 */
function isActiveHref(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(`/${href.split("/")[1]}`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const [logoFailed, setLogoFailed] = useState(false);
  const logoRef = useRef<HTMLImageElement>(null);

  // The <img> starts loading from the server-rendered HTML before React
  // hydrates. On localhost a 404 can resolve fast enough that its error event
  // fires while no listener is attached yet, so this catches that case on
  // mount; onError still covers a slower failure later.
  useEffect(() => {
    const img = logoRef.current;
    if (img && img.complete && img.naturalWidth === 0) setLogoFailed(true);
  }, []);

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border border-r">
      <SidebarHeader>
        {/* The logo file is a full lockup (mark + wordmark), so it only has
            room to render in the expanded state — collapsed to the icon rail
            falls back to the mark alone, which is also the fallback when the
            image is missing. */}
        <div className="flex items-center gap-2.5 px-1 py-1 group-data-[collapsible=icon]:px-0">
          <span className="bg-gradient-brand flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-[0_0_16px_-2px_var(--brand)]">
            <Sparkles className="size-4" strokeWidth={2.25} />
          </span>
          {logoFailed ? (
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-body font-semibold tracking-wide">JARVIS</p>
              <p className="truncate text-caption text-muted-foreground">Personal OS</p>
            </div>
          ) : (
            <img
              ref={logoRef}
              src={brand.logo}
              alt="JARVIS"
              className="min-w-0 rounded-lg group-data-[collapsible=icon]:hidden"
              onError={() => setLogoFailed(true)}
            />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {SIDEBAR_GROUPS.map((group, index) => (
          <SidebarGroup key={group.label ?? `group-${index}`}>
            {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = isActiveHref(pathname, item.href);
                  const category = categoryForHref(item.href);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        {/* Category tint on the active row only — every icon
                            tinted at once turns the nav into a colour chart
                            and stops the active state reading as state. */}
                        <Icon
                          className={cn(
                            isActive && (category ? CATEGORY_TEXT_CLASS[category] : "text-brand"),
                          )}
                          strokeWidth={isActive ? 2.25 : 1.75}
                        />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              isActive={pathname.startsWith("/settings")}
              tooltip="Settings"
            >
              <SettingsIcon strokeWidth={1.75} />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Single-user app, so this is an identity strip rather than an
              account switcher — there is no session record to switch. */}
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/settings" />} size="lg" tooltip={user.name}>
              <Avatar className="size-8 shrink-0 after:border-white/10">
                <AvatarImage src={user.avatar} alt="" />
                <AvatarFallback className="bg-gradient-brand font-semibold text-white">
                  {user.initial}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-caption font-medium">{user.name}</span>
                <span className="truncate text-caption text-muted-foreground">{user.workspace}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Drag-to-resize edge; also gives the collapsed rail a click target. */}
      <SidebarRail />
    </Sidebar>
  );
}
