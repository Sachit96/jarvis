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

export interface ModuleTab {
  href: string;
  label: string;
}

/** In-module sub-navigation, rendered below the module header on each page. */
export const LIFE_TABS: ModuleTab[] = [
  { href: "/life/tasks", label: "Tasks" },
  { href: "/life/goals", label: "Goals" },
  { href: "/life/habits", label: "Habits" },
  { href: "/life/journal", label: "Journal" },
  { href: "/life/prayer", label: "Prayer" },
];

export const FINANCE_TABS: ModuleTab[] = [
  { href: "/finance/overview", label: "Overview" },
  { href: "/finance/transactions", label: "Transactions" },
  { href: "/finance/accounts", label: "Accounts" },
  { href: "/finance/budgets", label: "Budgets" },
  { href: "/finance/trades", label: "Trades" },
  { href: "/finance/analysis", label: "Analysis" },
];

export const HEALTH_TABS: ModuleTab[] = [
  { href: "/health/workouts", label: "Workouts" },
  { href: "/health/nutrition", label: "Nutrition" },
];
