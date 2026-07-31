export interface BriefSection {
  heading: string;
  lines: string[];
}

/**
 * Splits the mentor brief's markdown_body into sections by "## Heading"
 * lines — the exact structure DAILY_INSTRUCTIONS/WEEKLY_INSTRUCTIONS in
 * lib/ai/mentor-brief.ts ask the model to produce (## Focus Today / ## Wins
 * / ## Watch-outs, or the weekly equivalents). A lightweight split-on-known-
 * format parser rather than a full markdown library, since the shape is
 * fully controlled by our own prompt.
 */
export function parseBriefSections(markdownBody: string): BriefSection[] {
  const lines = markdownBody.split("\n");
  const sections: BriefSection[] = [];
  let current: BriefSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      current = { heading: headingMatch[1].trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (!line) continue;
    if (!current) {
      current = { heading: "", lines: [] };
      sections.push(current);
    }
    current.lines.push(line);
  }

  return sections;
}

/** Strips markdown bullet/bold markers for contexts that just need plain text (e.g. a line-clamped preview). */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^[-*]\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .trim();
}

/** A stripped-markdown preview with its own leading heading dropped when it just restates the title (common for notes whose H1 is the title). */
export function bodyPreview(body: string, title: string): string {
  const stripped = stripMarkdown(body);
  const firstLine = stripped.split("\n")[0]?.trim();
  if (firstLine && firstLine.toLowerCase() === title.trim().toLowerCase()) {
    return stripped.slice(firstLine.length).trim();
  }
  return stripped;
}
