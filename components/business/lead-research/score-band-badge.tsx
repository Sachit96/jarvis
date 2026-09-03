import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { scoreBand, SCORE_BAND_LABEL } from "@/lib/validations/lead-research";

const BAND_CLASS: Record<ReturnType<typeof scoreBand>, string> = {
  hot: "border-success/40 bg-success/10 text-success",
  warm: "border-warn/40 bg-warn/10 text-warn",
  skip: "border-border text-muted-foreground",
};

/** Score band chip — 70+ hot / 40-69 warm / <40 skip. The number is always shown alongside the band so "hot" never has to be taken on faith. */
export function ScoreBandBadge({ score, className }: { score: number; className?: string }) {
  const band = scoreBand(score);
  return (
    <Badge variant="outline" className={cn("gap-1 font-mono text-[10px] uppercase", BAND_CLASS[band], className)}>
      {SCORE_BAND_LABEL[band]} · {score}
    </Badge>
  );
}
