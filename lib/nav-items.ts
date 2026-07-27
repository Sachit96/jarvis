import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ListChecks,
  Wallet,
  HeartPulse,
  Briefcase,
  Sparkles,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Bottom tab bar (mobile) / primary sidebar items (desktop). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/life/tasks", label: "Life", icon: ListChecks },
  { href: "/finance/overview", label: "Finance", icon: Wallet },
  { href: "/health/workouts", label: "Health", icon: HeartPulse },
  { href: "/business/dashboard", label: "Business", icon: Briefcase },
];

/** Cross-cutting — reachable via a floating button on mobile, folds into the sidebar on desktop. */
export const MENTOR_NAV_ITEM: NavItem = {
  href: "/mentor",
  label: "Mentor",
  icon: Sparkles,
};
