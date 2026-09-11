import type { LucideIcon } from "lucide-react";
import type { NavTarget } from "@/lib/nav-active";
import {
  LayoutDashboard,
  Target,
  ListChecks,
  Wallet,
  HeartPulse,
  Briefcase,
  Sparkles,
  BrainCircuit,
  Mic,
  Settings as SettingsIcon,
} from "lucide-react";

export interface NavItem extends NavTarget {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Re-exported so callers keep importing navigation from one place, while the
// resolution logic stays in a module the test runner can load.
export { activeNavHref, crumbHref } from "@/lib/nav-active";

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
  { href: "/life/tasks", label: "Tasks & Routine", icon: ListChecks, matches: ["/life/habits", "/life/journal"] },
  { href: "/mentor", label: "AI Mentor", icon: Sparkles },
  { href: "/voice", label: "Voice Mode", icon: Mic },
  { href: "/memory", label: "Memory", icon: BrainCircuit },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export interface NavGroup {
  /** Omitted for the first group — a lone "Home" doesn't need a heading over it. */
  label?: string;
  items: NavItem[];
}

/**
 * The same twelve destinations as SIDEBAR_ITEMS, in groups.
 *
 * Twelve flat rows is past the point where the eye scans and into where it
 * reads, and the order was carrying meaning ("priority") that nothing in the
 * UI expressed. Grouping by what part of life the section is about means the
 * user navigates by picking a domain first, which is how they think about it
 * anyway — and it puts the three assistant surfaces together, where their
 * relationship is obvious.
 *
 * SIDEBAR_ITEMS is still the flat source of truth for anything that wants
 * every destination without caring about grouping (the command palette).
 */
export const SIDEBAR_GROUPS: NavGroup[] = [
  { items: [{ href: "/", label: "Home", icon: LayoutDashboard }] },
  {
    label: "Money",
    items: [
      { href: "/business/dashboard", label: "Business", icon: Briefcase },
      { href: "/finance/overview", label: "Finance", icon: Wallet },
    ],
  },
  {
    label: "Self",
    items: [
      { href: "/health/workouts", label: "Health", icon: HeartPulse },
      { href: "/life/goals", label: "Goals", icon: Target },
      { href: "/life/tasks", label: "Tasks & Routine", icon: ListChecks, matches: ["/life/habits", "/life/journal"] },
        ],
  },
  {
    label: "Assistant",
    items: [
      { href: "/mentor", label: "AI Mentor", icon: Sparkles },
      { href: "/voice", label: "Voice Mode", icon: Mic },
      { href: "/memory", label: "Memory", icon: BrainCircuit },
    ],
  },
];

/**
 * Curated subset for the mobile bottom bar — five is the most a thumb can
 * reach comfortably.
 *
 * University used to hold the second slot and its removal freed one, which
 * goes to Goals: with Tasks reachable from Home's priority widget, Goals
 * was the remaining domain with no prominent surface of its own on a
 * phone.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/business/dashboard", label: "Business", icon: Briefcase },
  { href: "/finance/overview", label: "Finance", icon: Wallet },
  { href: "/health/workouts", label: "Health", icon: HeartPulse },
  { href: "/life/goals", label: "Goals", icon: Target },
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
  { href: "/health/body", label: "Body" },
];

export const BUSINESS_TABS: ModuleTab[] = [
  { href: "/business/dashboard", label: "Dashboard" },
  { href: "/business/leads", label: "Leads" },
  { href: "/business/pipeline", label: "Pipeline" },
  { href: "/business/clients", label: "Clients" },
  { href: "/business/revenue", label: "Revenue" },
];

export const MENTOR_TABS: ModuleTab[] = [
  { href: "/mentor", label: "Today" },
  { href: "/mentor/weekly-review", label: "Weekly Review" },
];

