import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function MentorInsightCard({
  markdownBody,
  focusAreas,
}: {
  markdownBody: string | null;
  focusAreas: string[];
}) {
  return (
    <Link href="/mentor" className="block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Card interactive className="ring-brand/25">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <p className="text-label uppercase tracking-wide text-brand">AI Mentor Insight</p>
        </div>
        <p className="mt-2 line-clamp-3 text-body text-muted-foreground">
          {markdownBody ?? "No brief yet today — tap to have your mentor look things over."}
        </p>
        {focusAreas.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {focusAreas.map((area, i) => (
              <Badge key={i} variant="outline" className="text-brand border-brand/40">
                {area}
              </Badge>
            ))}
          </div>
        ) : null}
      </Card>
    </Link>
  );
}
