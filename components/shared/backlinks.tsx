import Link from "next/link";
import { Link2 } from "lucide-react";
import type { Backlink, NoteLinkType } from "@/lib/obsidian/wikilinks";

/** Where a backlink's source actually lives — used to make its title clickable. Mirrors the five LINKABLE_TYPES in lib/obsidian/wikilinks.ts. */
function hrefFor(type: NoteLinkType, id: string): string | null {
  switch (type) {
    case "memory_entry":
      return `/memory?entry=${id}`;
    case "uni_course":
      return `/uni/courses/${id}`;
    case "journal_entry":
      return `/life/journal`;
    case "contact":
      return `/business/clients/${id}`;
    case "deal":
      return `/business/pipeline/${id}`;
  }
}

const TYPE_LABEL: Record<NoteLinkType, string> = {
  memory_entry: "Memory",
  contact: "Contact",
  uni_course: "Course",
  deal: "Deal",
  journal_entry: "Journal",
};

/**
 * "Referenced by" — shown on memory entries, contacts, courses, deals and
 * journal entries, wherever something else's [[wikilink]] points at this
 * note. Renders nothing when there are no backlinks, rather than an empty
 * heading.
 *
 * `card` puts the surface INSIDE this component, so an empty backlinks list
 * takes its panel with it. Three detail pages wrapped it in their own
 * `<div className="surface p-4">`, and since the wrapper rendered whether or
 * not there was anything to wrap, every record with no inbound links showed
 * a blank card sitting in the middle of the page.
 */
export function Backlinks({ backlinks, card = false }: { backlinks: Backlink[]; card?: boolean }) {
  if (backlinks.length === 0) return null;

  return (
    <div className={card ? "surface p-4" : undefined}>
      <p className="flex items-center gap-1.5 eyebrow">
        <Link2 className="h-3 w-3" /> Referenced by
      </p>
      <ul className="mt-1.5 space-y-1">
        {backlinks.map((b) => {
          const href = hrefFor(b.sourceType, b.sourceId);
          const content = (
            <>
              <span className="text-caption text-muted-foreground">{TYPE_LABEL[b.sourceType]}</span>{" "}
              <span className="text-foreground">{b.title}</span>
            </>
          );
          return (
            <li key={`${b.sourceType}-${b.sourceId}`} className="text-sm">
              {href ? (
                <Link href={href} className="hover:underline">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
