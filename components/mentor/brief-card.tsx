import { Card } from "@/components/ui/card";
import { MentorBriefSections } from "@/components/mentor/mentor-brief-sections";

/**
 * Filled chips rather than outlined ones.
 *
 * Three rows of brightly outlined pills in three different colours turned
 * the brief's footer into the loudest thing on the page. The distinction
 * between a strength and a weakness is real, so the colour stays — at a
 * tint, where it reads as a category rather than a warning light.
 */
function TagList({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className={`rounded-full px-2.5 py-1 text-caption font-medium ${tone}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BriefCard({
  dateLabel,
  markdownBody,
  focusAreas,
  strengths,
  weaknesses,
}: {
  dateLabel: string;
  markdownBody: string;
  focusAreas: string[];
  strengths: string[];
  weaknesses: string[];
}) {
  return (
    <Card className="space-y-4" elevation="raised">
      <p className="eyebrow">{dateLabel}</p>
      <MentorBriefSections markdownBody={markdownBody} />
      {focusAreas.length > 0 || strengths.length > 0 || weaknesses.length > 0 ? (
        <div className="space-y-3 border-t border-white/[0.08] pt-3.5">
          <TagList label="Focus areas" items={focusAreas} tone="bg-[color-mix(in_oklab,var(--brand)_22%,transparent)] text-white" />
          <TagList label="Strengths" items={strengths} tone="bg-success/12 text-success" />
          <TagList label="Weaknesses" items={weaknesses} tone="bg-warn/12 text-warn" />
        </div>
      ) : null}
    </Card>
  );
}
