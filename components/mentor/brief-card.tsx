import { Badge } from "@/components/ui/badge";

function TagList({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
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
    <div className="space-y-4 rounded-lg border border-brand/40 bg-card p-4">
      <p className="font-mono text-xs text-muted-foreground">{dateLabel}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{markdownBody}</p>
      <div className="space-y-3 border-t border-border pt-3">
        <TagList label="Focus areas" items={focusAreas} tone="text-brand border-brand/40" />
        <TagList label="Strengths" items={strengths} tone="text-success border-success/40" />
        <TagList label="Weaknesses" items={weaknesses} tone="text-danger border-danger/40" />
      </div>
    </div>
  );
}
