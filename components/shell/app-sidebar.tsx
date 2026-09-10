"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
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
import { RadarMark } from "@/components/shell/radar-mark";
import { SIDEBAR_GROUPS } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { user } from "@/lib/user";

/**
 * A nav row is active for its whole module, not just its exact href —
 * /finance/budgets should still light "Finance" up. Home is the exception,
 * since every path starts with "/".
 */
function isActiveHref(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(`/${href.split("/")[1]}`);
}

/**
 * The active row, styled here rather than in the vendored ui/sidebar so the
 * primitive stays upgradable.
 *
 * The previous active state was `bg-sidebar-accent` — a flat grey pill,
 * indistinguishable from hover, which is exactly what made the nav read as
 * a generic admin sidebar. This is a lit glass surface with a gradient bar
 * on the leading edge: the row reads as a *selected system module*, and the
 * gradient appears in the one place per screen where something is genuinely
 * selected, so it keeps meaning something.
 */
const ACTIVE_ROW = cn(
  "relative data-active:bg-white/[0.055] data-active:text-white",
  "data-active:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)]",
  // The indicator is a pseudo-element so it cannot affect the row's layout
  // and therefore cannot shift the label when a row becomes active.
  "data-active:before:absolute data-active:before:left-0 data-active:before:top-1.5 data-active:before:bottom-1.5",
  "data-active:before:w-[3px] data-active:before:rounded-full data-active:before:bg-[image:var(--gradient-brand)]",
  "data-active:before:shadow-[0_0_12px_0_color-mix(in_oklab,var(--brand)_60%,transparent)]",
  // Collapsed to the icon rail there is no room for a leading bar, so the
  // whole chip carries the brand tint instead.
  "group-data-[collapsible=icon]:data-active:before:hidden",
  "group-data-[collapsible=icon]:data-active:bg-[color-mix(in_oklab,var(--brand)_22%,transparent)]",
);

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border border-r">
      <SidebarHeader>
        {/* The brand lockup: the radar mark IS the logo, so the identity
            motif is established before the user reaches any content. No
            image file — the previous lockup pointed at a PNG that does not
            exist in public/, so every page rendered a broken-image icon
            next to the word JARVIS. Found in the browser. */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 group-data-[collapsible=icon]:px-0"
        >
          <RadarMark size={32} sweep={false} className="shrink-0" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="font-display text-body leading-none font-semibold tracking-[0.14em]">JARVIS</p>
            <p className="eyebrow mt-1.5">Personal OS</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {SIDEBAR_GROUPS.map((group, index) => (
          <SidebarGroup key={group.label ?? `group-${index}`}>
            {group.label ? (
              <SidebarGroupLabel className="eyebrow h-auto px-2 pt-1 pb-1.5">{group.label}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = isActiveHref(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive}
                        tooltip={item.label}
                        className={cn("h-9 gap-2.5 rounded-lg pl-3 text-foreground-secondary", ACTIVE_ROW)}
                      >
                        {/* No per-domain icon tint. Six category hues across
                            a nav is a colour chart, and it stopped the
                            active state from reading as state — the row's
                            own surface says which module is selected. */}
                        <Icon strokeWidth={isActive ? 2.1 : 1.75} />
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
              className={cn("h-9 gap-2.5 rounded-lg pl-3 text-foreground-secondary", ACTIVE_ROW)}
            >
              <SettingsIcon strokeWidth={1.75} />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Single-user app, so this is an identity strip rather than an
              account switcher — there is no session record to switch. */}
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              size="lg"
              tooltip={user.name}
              className="rounded-lg"
            >
              <Avatar className="size-8 shrink-0 after:border-white/10">
                <AvatarImage src={user.avatar} alt="" />
                <AvatarFallback className="bg-gradient-brand font-semibold text-white">
                  {user.initial}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-caption font-medium">{user.name}</span>
                <span className="truncate text-caption text-foreground-tertiary">{user.workspace}</span>
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
