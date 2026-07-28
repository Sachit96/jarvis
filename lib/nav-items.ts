import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Target,
  ListChecks,
  Wallet,
  HeartPulse,
  Briefcase,
  Sparkles,
  BrainCircuit,
  Settings as SettingsIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Full nav — desktop sidebar, in the app's priority order.
 * "Faith" no longer exists as its own item — "Pray to God" is now a Daily
 * Routine checklist item (see /life/habits) instead of a standalone section.
 * "Memory" has no feature behind it yet (see /memory) — it's here as a
 * placeholder link, same pattern as the Coming Soon pages elsewhere.
 */
export const SIDEBAR_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/business/dashboard", label: "Business", icon: Briefcase },
  { href: "/health/workouts", label: "Health", icon: HeartPulse },
  { href: "/finance/overview", label: "Finance", icon: Wallet },
  { href: "/life/goals", label: "Goals", icon: Target },
  { href: "/life/tasks", label: "Tasks & Routine", icon: ListChecks },
  { href: "/mentor", label: "AI Mentor", icon: Sparkles },
  { href: "/memory", label: "Memory", icon: BrainCircuit },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

/** Curated subset for the mobile bottom bar — five is the most a thumb can reach comfortably. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/life/tasks", label: "Tasks", icon: ListChecks },
  { href: "/finance/overview", label: "Finance", icon: Wallet },
  { href: "/health/workouts", label: "Health", icon: HeartPulse },
  { href: "/business/dashboard", label: "Business", icon: Briefcase },
];

export interface ModuleTab {
  href: string;
  label: string;
}

/** In-module sub-navigation, rendered below the module header on each page. */
export const TASKS_TABS: ModuleTab[] = [
  { href: "/life/tasks", label: "Tasks" },
  { href: "/life/habits", label: "Routine" },
  { href: "/life/journal", label: "Journal" },
];

// GOALS_TABS was retired (Habits/Routine moved fully under Tasks & Routine,
// so Goals is now a standalone page with no tab row, matching Tasks OS
// pattern before it got its own tabs). FAITH_TABS was removed entirely
// along with the standalone /life/prayer page it pointed to.

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

export const BUSINESS_TABS: ModuleTab[] = [
  { href: "/business/dashboard", label: "Dashboard" },
  { href: "/business/pipeline", label: "Pipeline" },
  { href: "/business/clients", label: "Clients" },
  { href: "/business/revenue", label: "Revenue" },
];

export const MENTOR_TABS: ModuleTab[] = [
  { href: "/mentor", label: "Today" },
  { href: "/mentor/weekly-review", label: "Weekly Review" },
];
