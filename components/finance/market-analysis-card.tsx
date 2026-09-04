"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { deleteMarketAnalysisAction } from "@/actions/trading-actions";
import type { Database } from "@/lib/supabase/database.types";

type MarketAnalysis = Database["public"]["Tables"]["market_analyses"]["Row"];

const SENTIMENT_TONE: Record<string, string> = {
  bullish: "text-success border-success/40",
  bearish: "text-danger border-danger/40",
  choppy: "text-warn border-warn/40",
};

function TimeframeRow({
  label,
  sentiment,
  notes,
}: {
  label: string;
  sentiment: string | null;
  notes: string | null;
}) {
  if (!sentiment && !notes) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
      {sentiment ? (
        <Badge variant="outline" className={cn("shrink-0 text-[10px] uppercase", SENTIMENT_TONE[sentiment])}>
          {sentiment}
        </Badge>
      ) : null}
      {notes ? <span className="min-w-0 text-muted-foreground">{notes}</span> : null}
    </div>
  );
}

export function MarketAnalysisCard({ analysis }: { analysis: MarketAnalysis }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", isPending && "opacity-50")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{analysis.pair}</p>
          <p className="font-mono text-xs text-muted-foreground">{analysis.analysis_date}</p>
        </div>
        <button
          onClick={() => startTransition(() => deleteMarketAnalysisAction(analysis.id))}
          aria-label="Delete analysis"
          className="relative after:absolute after:-inset-3.5 text-muted-foreground hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 space-y-1.5">
        <TimeframeRow label="Weekly" sentiment={analysis.weekly_sentiment} notes={analysis.weekly_notes} />
        <TimeframeRow label="Daily" sentiment={analysis.daily_sentiment} notes={analysis.daily_notes} />
        <TimeframeRow label="4H" sentiment={analysis.h4_sentiment} notes={analysis.h4_notes} />
      </div>
    </div>
  );
}
