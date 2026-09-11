/**
 * The knowledge graph behind Voice Mode, as pure functions.
 *
 * Built from what JARVIS actually knows — memory entries, their types and
 * their tags — rather than a decorative node cloud. That distinction is the
 * whole point: a graph that invents its own nodes is a screensaver, and it
 * would show the same shape on an empty account as on a full one.
 *
 * No React and no three.js here, so the clustering and the search can be
 * tested directly instead of by rendering a WebGL canvas.
 */

/** Memory entry fields this needs; the real row satisfies it. */
export interface BrainEntry {
  id: string;
  title: string;
  body: string;
  type: string;
  tags: string[];
  pinned: boolean;
}

export interface BrainNode {
  id: string;
  label: string;
  /** "category" nodes are the hubs; "entry" nodes are real memory rows. */
  kind: "root" | "category" | "entry";
  /** The category this belongs to, for colouring and for camera focus. */
  category: string;
  /** Render size. Pinned entries and busy categories sit larger. */
  size: number;
  /** Full text for search and for the hover card. */
  detail?: string;
}

export interface BrainLink {
  source: string;
  target: string;
}

export interface BrainGraph {
  nodes: BrainNode[];
  links: BrainLink[];
  /** Category ids in render order, so the legend and the graph agree. */
  categories: { id: string; label: string; count: number }[];
}

export const ROOT_ID = "__jarvis__";

/**
 * Category colours.
 *
 * Keyed by category id so a colour survives a re-render and a re-layout —
 * assigning by array index would recolour the whole graph whenever a new
 * category appeared, which reads as the graph having changed meaning.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  fact: "#9C35F0",
  preference: "#ec4899",
  person: "#f472b6",
  project: "#38bdf8",
  protocol: "#22d3ee",
  reference: "#34d399",
  tool: "#34d399",
  business: "#fbbf24",
  outreach: "#ec4899",
  finance: "#fbbf24",
  tech: "#38bdf8",
  health: "#4ade80",
};

export const FALLBACK_COLOR = "#a78bfa";

export function colorForCategory(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? FALLBACK_COLOR;
}

/** Title-cases a slug-ish category id for display. */
function labelFor(category: string): string {
  return category.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Which cluster an entry belongs to.
 *
 * A tag wins over the row's `type` when one of the tags is a category this
 * graph already knows how to colour — "business" and "outreach" are far
 * more useful groupings than "fact", and almost everything is a fact.
 */
export function categoryOf(entry: BrainEntry): string {
  const known = entry.tags.find((tag) => tag.toLowerCase() in CATEGORY_COLORS);
  if (known) return known.toLowerCase();
  return (entry.type || "fact").toLowerCase();
}

/**
 * Nodes and links for the whole brain.
 *
 * Shape is a hub-and-spoke, two levels deep: one root, a node per category,
 * and an entry hanging off its category. A fully-connected mesh looks more
 * impressive and says less — with everything linked to everything, no
 * cluster is visibly a cluster.
 */
export function buildBrainGraph(entries: BrainEntry[]): BrainGraph {
  const byCategory = new Map<string, BrainEntry[]>();
  for (const entry of entries) {
    const category = categoryOf(entry);
    const list = byCategory.get(category) ?? [];
    list.push(entry);
    byCategory.set(category, list);
  }

  // Biggest cluster first, so the legend leads with what the brain is
  // mostly made of. Ties break alphabetically to keep the order stable
  // across renders rather than following insertion order.
  const categories = [...byCategory.entries()]
    .map(([id, list]) => ({ id, label: labelFor(id), count: list.length }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

  const nodes: BrainNode[] = [
    { id: ROOT_ID, label: "JARVIS", kind: "root", category: "root", size: 9 },
  ];
  const links: BrainLink[] = [];

  for (const category of categories) {
    nodes.push({
      id: `cat:${category.id}`,
      label: category.label,
      kind: "category",
      category: category.id,
      // Grows with the cluster but sub-linearly: a category with 40 entries
      // should read as bigger than one with 4, not ten times bigger.
      size: 4 + Math.sqrt(category.count) * 1.2,
      detail: `${category.count} ${category.count === 1 ? "entry" : "entries"}`,
    });
    links.push({ source: ROOT_ID, target: `cat:${category.id}` });

    for (const entry of byCategory.get(category.id) ?? []) {
      nodes.push({
        id: entry.id,
        label: entry.title,
        kind: "entry",
        category: category.id,
        size: entry.pinned ? 3.4 : 2.2,
        detail: entry.body,
      });
      links.push({ source: `cat:${category.id}`, target: entry.id });
    }
  }

  return { nodes, links, categories };
}

/**
 * Nodes matching a search term.
 *
 * Returns ids rather than nodes so the caller can dim the rest without
 * rebuilding the graph — re-running the force simulation on every keystroke
 * would make the whole thing lurch while you type.
 *
 * A matched entry keeps its category and the root visible, so a hit is
 * never left floating with no visible path back to where it belongs.
 */
export function searchBrain(graph: BrainGraph, term: string): Set<string> {
  const needle = term.trim().toLowerCase();
  if (!needle) return new Set(graph.nodes.map((n) => n.id));

  const matched = new Set<string>();
  for (const node of graph.nodes) {
    if (node.kind === "root") continue;
    const haystack = `${node.label} ${node.detail ?? ""} ${node.category}`.toLowerCase();
    if (haystack.includes(needle)) {
      matched.add(node.id);
      if (node.kind === "entry") matched.add(`cat:${node.category}`);
    }
  }
  if (matched.size > 0) matched.add(ROOT_ID);
  return matched;
}

/**
 * The node a spoken phrase is about, or null.
 *
 * Drives the camera: when JARVIS says "your outreach pipeline", the view
 * flies to that cluster. Deliberately conservative — a wrong fly-to is more
 * disorienting than none, so this only matches a node whose label appears
 * in the text as a whole word, and prefers the longest such label so
 * "Email Funnel" beats "Email".
 */
export function focusTargetFor(graph: BrainGraph, text: string): BrainNode | null {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ")} `;
  let best: BrainNode | null = null;

  for (const node of graph.nodes) {
    if (node.kind === "root") continue;
    const label = node.label.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    // Single characters and very short labels match far too much text.
    if (label.length < 3) continue;
    if (!haystack.includes(` ${label} `)) continue;
    if (!best || label.length > best.label.length) best = node;
  }

  return best;
}
