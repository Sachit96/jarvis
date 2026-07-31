import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MentorBriefSections } from "@/components/mentor/mentor-brief-sections";

function TagList({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-caption uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <Badge key={i} variant="outline" className={tone}>
            {item}
          </Badge>
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
    <Card className="space-y-4 ring-brand/25">
      <p className="font-mono text-caption text-muted-foreground">{dateLabel}</p>
      <MentorBriefSections markdownBody={markdownBody} />
      {focusAreas.length > 0 || strengths.length > 0 || weaknesses.length > 0 ? (
        <div className="space-y-3 border-t border-white/[0.08] pt-3.5">
          <TagList label="Focus areas" items={focusAreas} tone="text-brand border-brand/40" />
          <TagList label="Strengths" items={strengths} tone="text-success border-success/40" />
          <TagList label="Weaknesses" items={weaknesses} tone="text-danger border-danger/40" />
        </div>
      ) : null}
    </Card>
  );
}
