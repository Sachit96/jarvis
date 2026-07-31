export type Category = "money" | "business" | "health" | "goals" | "finance" | "habits";

/** One fixed color per domain, reused everywhere (nav icons, stat-tile
 * badges, chart legends/lines, activity-feed badges) — see the
 * --cat-* tokens in app/globals.css. */
export const CATEGORY_LABEL: Record<Category, string> = {
  money: "Money",
  business: "Business",
  health: "Health",
  goals: "Goals",
  finance: "Finance",
  habits: "Habits",
};

/** Tailwind class fragment for a tinted circular icon badge. */
export const CATEGORY_BADGE_CLASS: Record<Category, string> = {
  money: "bg-cat-money/15 text-cat-money",
  business: "bg-cat-business/15 text-cat-business",
  health: "bg-cat-health/15 text-cat-health",
  goals: "bg-cat-goals/15 text-cat-goals",
  finance: "bg-cat-finance/15 text-cat-finance",
  habits: "bg-cat-habits/15 text-cat-habits",
};

/** Raw CSS color value per category, for contexts that need an actual color (SVG/recharts stroke/fill), not a Tailwind class. */
export const CATEGORY_HEX: Record<Category, string> = {
  money: "#22c55e",
  business: "#8b5cf6",
  health: "#ef4444",
  goals: "#3b82f6",
  finance: "#f97316",
  habits: "#ec4899",
};

/** Plain text-color class per category, for icons/labels that just need a tint (no badge background). */
export const CATEGORY_TEXT_CLASS: Record<Category, string> = {
  money: "text-cat-money",
  business: "text-cat-business",
  health: "text-cat-health",
  goals: "text-cat-goals",
  finance: "text-cat-finance",
  habits: "text-cat-habits",
};

/** Best-effort category guess from a route href, for components (activity feed, nav) that only have a link, not real category metadata. */
export function categoryForHref(href: string): Category | null {
  if (href.startsWith("/business")) return "business";
  if (href.startsWith("/health")) return "health";
  if (href.startsWith("/finance/trades") || href.startsWith("/finance/analysis")) return "finance";
  if (href.startsWith("/finance")) return "money";
  if (href.startsWith("/life/goals")) return "goals";
  if (href.startsWith("/life")) return "habits";
  return null;
}
