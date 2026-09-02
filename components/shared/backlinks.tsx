import Link from "next/link";
import { Link2 } from "lucide-react";
import type { Backlink, NoteLinkType } from "@/lib/obsidian/wikilinks";

/** Where a backlink's source actually lives — used to make its title clickable. Mirrors the five LINKABLE_TYPES in lib/obsidian/wikilinks.ts; contacts and deals have no dedicated detail page yet, so those two just aren't links. */
function hrefFor(type: NoteLinkType, id: string): string | null {
  switch (type) {
    case "memory_entry":
      return `/memory?entry=${id}`;
    case "uni_course":
      return `/uni/courses/${id}`;
    case "journal_entry":
      return `/life/journal`;
    case "contact":
    case "deal":
      return null;
  }
}

const TYPE_LABEL: Record<NoteLinkType, string> = {
  memory_entry: "Memory",
  contact: "Contact",
  uni_course: "Course",
  deal: "Deal",
  journal_entry: "Journal",
};

/** "Referenced by" section — shown on memory entries, contacts, courses, deals, and journal entries, anywhere something else's [[wikilink]] points at this note. Renders nothing if there are no backlinks, rather than an empty "Referenced by" heading. */
export function Backlinks({ backlinks }: { backlinks: Backlink[] }) {
  if (backlinks.length === 0) return null;

  return (
    <div>
      <p className="flex items-center gap-1.5 text-caption uppercase tracking-wide text-muted-foreground">
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
