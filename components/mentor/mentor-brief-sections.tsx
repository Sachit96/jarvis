import type { LucideIcon } from "lucide-react";
import { Target, Trophy, AlertTriangle, FileText, TrendingUp, AlertCircle, CalendarClock, Sparkles } from "lucide-react";
import { parseBriefSections } from "@/lib/mentor-format";

interface SectionStyle {
  icon: LucideIcon;
  accent: string; // text/icon color class
  badge: string; // icon badge background class
}

/** Known section headings (from lib/ai/mentor-brief.ts's prompts) get a distinct icon + accent color; anything else falls back to a neutral style. */
const SECTION_STYLES: Record<string, SectionStyle> = {
  "focus today": { icon: Target, accent: "text-brand", badge: "bg-brand/15" },
  wins: { icon: Trophy, accent: "text-success", badge: "bg-success/15" },
  "watch-outs": { icon: AlertTriangle, accent: "text-warn", badge: "bg-warn/15" },
  summary: { icon: FileText, accent: "text-brand", badge: "bg-brand/15" },
  strengths: { icon: TrendingUp, accent: "text-success", badge: "bg-success/15" },
  weaknesses: { icon: AlertCircle, accent: "text-warn", badge: "bg-warn/15" },
  "next week's focus": { icon: CalendarClock, accent: "text-brand", badge: "bg-brand/15" },
};
const FALLBACK_STYLE: SectionStyle = { icon: Sparkles, accent: "text-muted-foreground", badge: "bg-white/[0.06]" };

/** Renders `**bold**` spans within a line as real <strong> elements, everything else as plain text. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*\*(.+)\*\*$/);
    return boldMatch ? <strong key={i} className="font-semibold text-foreground">{boldMatch[1]}</strong> : <span key={i}>{part}</span>;
  });
}

/**
 * Shared renderer for AI Mentor briefs (daily + weekly) — used by both the
 * Home "Morning Brief" card and the full /mentor and /mentor/weekly-review
 * pages, so the two never drift out of sync. Splits markdown_body into
 * "## Heading" sections and gives each a distinct icon + accent color
 * rather than showing the raw markdown text.
 */
export function MentorBriefSections({
  markdownBody,
  compact = false,
  maxSections,
}: {
  markdownBody: string;
  compact?: boolean;
  /** Show only the first N sections — used for the Home preview card, which links to the full brief for the rest. */
  maxSections?: number;
}) {
  let sections = parseBriefSections(markdownBody).filter((s) => s.heading);
  if (maxSections) sections = sections.slice(0, maxSections);

  if (sections.length === 0) {
    return <p className="text-body text-muted-foreground whitespace-pre-line">{markdownBody}</p>;
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {sections.map((section, i) => {
        const style = SECTION_STYLES[section.heading.toLowerCase()] ?? FALLBACK_STYLE;
        const Icon = style.icon;
        return (
          <div key={i}>
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style.badge}`}>
                <Icon className={`h-3.5 w-3.5 ${style.accent}`} strokeWidth={2.25} />
              </span>
              <p className={`text-label font-semibold uppercase tracking-wide ${style.accent}`}>{section.heading}</p>
            </div>
            <div className={compact ? "mt-1.5 ml-8 space-y-1" : "mt-2 ml-8 space-y-1.5"}>
              {section.lines.map((line, j) => {
                const bulletMatch = line.match(/^[-*]\s+(.+)$/);
                if (bulletMatch) {
                  return (
                    <div key={j} className="flex items-start gap-1.5 text-body text-foreground">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                      <span>{renderInline(bulletMatch[1])}</span>
                    </div>
                  );
                }
                return (
                  <p key={j} className="text-body text-foreground">
                    {renderInline(line)}
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
