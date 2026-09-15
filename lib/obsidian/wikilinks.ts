import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type NoteLinkType = "memory_entry" | "contact" | "uni_course" | "deal" | "journal_entry";

/** [[Title]] or [[Title|Display text]] — the Obsidian wikilink syntax used throughout the existing vault (see Jarvis memory/00-INDEX.md). */
const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

export function parseWikilinks(text: string): string[] {
  const titles: string[] = [];
  for (const match of text.matchAll(WIKILINK_PATTERN)) {
    const title = match[1].trim();
    if (title) titles.push(title);
  }
  return titles;
}

interface DomainConfig {
  table: "memory_entries" | "contacts" | "uni_courses" | "deals" | "journal_entries";
  /** Every field a wikilink's title text might match against — checked case-insensitively. */
  titleFields: string[];
  /** Body-ish fields scanned for outgoing [[...]] references when this domain acts as a link SOURCE. */
  textFields: string[];
}

const DOMAINS: Record<NoteLinkType, DomainConfig> = {
  memory_entry: { table: "memory_entries", titleFields: ["title"], textFields: ["body"] },
  contact: { table: "contacts", titleFields: ["company_name", "contact_person"], textFields: ["notes"] },
  uni_course: { table: "uni_courses", titleFields: ["code", "name"], textFields: ["description"] },
  deal: { table: "deals", titleFields: ["title"], textFields: ["notes"] },
  journal_entry: { table: "journal_entries", titleFields: ["title"], textFields: ["body"] },
};

/** Every domain a wikilink can resolve into, and every domain whose own text can contain outgoing links — the same five in both directions. */
export const LINKABLE_TYPES = Object.keys(DOMAINS) as NoteLinkType[];

interface ResolvedTarget {
  type: NoteLinkType;
  id: string;
}

/** Looks up every LINKABLE_TYPES table for a case-insensitive title match — a title can legitimately match more than one domain (rare but possible, e.g. a course code that's also someone's company name); every match becomes its own link rather than guessing which one was meant. */
async function resolveTitle(supabase: Client, title: string): Promise<ResolvedTarget[]> {
  const needle = title.trim().toLowerCase();
  const results: ResolvedTarget[] = [];

  for (const type of LINKABLE_TYPES) {
    const config = DOMAINS[type];
    // select("*") rather than a dynamically-built column list — Supabase's
    // generated types can't infer a shape from a computed select string
    // (the whole point of DOMAINS being data, not a switch statement), and
    // these tables are all small enough that selecting extra columns costs nothing real.
    const { data } = await supabase.from(config.table).select("*");
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const matches = config.titleFields.some((field) => {
        const value = row[field];
        return typeof value === "string" && value.trim().toLowerCase() === needle;
      });
      if (matches) results.push({ type, id: row.id as string });
    }
  }
  return results;
}

/**
 * Re-parses one note's outgoing wikilinks and replaces its note_links rows
 * to match — call this after creating/updating a memory entry, journal
 * entry, or any other linkable row whose text fields were just written.
 * Delete-then-insert rather than a diff, since a note's whole set of
 * outgoing links is small and this keeps the logic simple and correct
 * (no risk of a stale link surviving an edit that removed it).
 */
export async function syncOutgoingLinks(supabase: Client, sourceType: NoteLinkType, sourceId: string, text: string): Promise<void> {
  const titles = parseWikilinks(text);
  await supabase.from("note_links").delete().eq("source_type", sourceType).eq("source_id", sourceId);
  if (titles.length === 0) return;

  const seen = new Set<string>();
  for (const title of titles) {
    const targets = await resolveTitle(supabase, title);
    for (const target of targets) {
      if (target.type === sourceType && target.id === sourceId) continue; // no self-links
      const key = `${target.type}:${target.id}`;
      if (seen.has(key)) continue; // the same title referenced twice in one note is still one link
      seen.add(key);
      await supabase.from("note_links").insert({ source_type: sourceType, source_id: sourceId, target_type: target.type, target_id: target.id, link_text: title });
    }
  }
}

/** Re-syncs outgoing links for every text field a domain declares, in one call — the actual function most create/update actions call. */
export async function syncOutgoingLinksForRow(supabase: Client, sourceType: NoteLinkType, sourceId: string, row: Record<string, unknown>): Promise<void> {
  const config = DOMAINS[sourceType];
  const text = config.textFields.map((f) => row[f]).filter((v): v is string => typeof v === "string").join("\n\n");
  await syncOutgoingLinks(supabase, sourceType, sourceId, text);
}

export interface Backlink {
  sourceType: NoteLinkType;
  sourceId: string;
  title: string;
  linkText: string;
}

/** Everything that links TO the given note — the "referenced by" section shown on memory entries, contacts, courses, deals, and journal entries. */
export async function getBacklinks(supabase: Client, targetType: NoteLinkType, targetId: string): Promise<Backlink[]> {
  const { data: links } = await supabase.from("note_links").select("*").eq("target_type", targetType).eq("target_id", targetId);
  if (!links || links.length === 0) return [];

  const backlinks: Backlink[] = [];
  for (const link of links) {
    const sourceType = link.source_type as NoteLinkType;
    const config = DOMAINS[sourceType];
    const { data: row } = await supabase.from(config.table).select("*").eq("id", link.source_id).maybeSingle();
    if (!row) continue; // source was deleted since the link was recorded
    const r = row as unknown as Record<string, unknown>;
    const title = config.titleFields.map((f) => r[f]).find((v): v is string => typeof v === "string" && v.length > 0) ?? "(untitled)";
    backlinks.push({ sourceType, sourceId: link.source_id, title, linkText: link.link_text });
  }
  return backlinks;
}
