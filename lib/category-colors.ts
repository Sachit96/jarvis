export type Category = "money" | "business" | "health" | "goals" | "finance" | "habits";

/**
 * The six life domains, by name.
 *
 * This module used to be the app's second palette: a fixed colour per
 * domain, applied to nav icons, stat-tile badges, activity rows and chart
 * series alike. That is what made twelve unrelated hues appear on chrome
 * across every screen while the brand's own purple and magenta showed up
 * almost nowhere.
 *
 * The colour exports are gone. Chrome carries no domain tint at all now —
 * the label already says which domain a thing belongs to — and charts take
 * `--chart-*` slots in order (see app/globals.css), which are built from
 * the same validated hues but lead with the brand pair. What survives here
 * is the vocabulary: the names, and the best-effort mapping from a route to
 * the domain it belongs to.
 */
export const CATEGORY_LABEL: Record<Category, string> = {
  money: "Money",
  business: "Business",
  health: "Health",
  goals: "Goals",
  finance: "Finance",
  habits: "Habits",
};

/**
 * Best-effort domain guess from a route href, for components (the activity
 * feed) that only have a link and use it to pick an ICON — never a colour.
 */
export function categoryForHref(href: string): Category | null {
  if (href.startsWith("/business")) return "business";
  if (href.startsWith("/health")) return "health";
  if (href.startsWith("/finance/trades") || href.startsWith("/finance/analysis")) return "finance";
  if (href.startsWith("/finance")) return "money";
  if (href.startsWith("/life/goals")) return "goals";
  if (href.startsWith("/life")) return "habits";
  return null;
}
