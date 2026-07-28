import Link from "next/link";
import { Card } from "@/components/ui/card";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function BusinessSnapshotCard({
  openValue,
  openCount,
  winRate,
  mrr,
}: {
  openValue: number;
  openCount: number;
  winRate: number;
  mrr: number;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-label uppercase tracking-wide text-muted-foreground">Business Snapshot</p>
        <Link href="/business/dashboard" className="text-label text-brand hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <p className="font-mono text-heading text-foreground">{money(openValue)}</p>
          <p className="text-caption text-muted-foreground">{openCount} open deal(s)</p>
        </div>
        <div>
          <p className="font-mono text-heading text-foreground">{winRate}%</p>
          <p className="text-caption text-muted-foreground">Win rate</p>
        </div>
        <div>
          <p className="font-mono text-heading text-success">{money(mrr)}</p>
          <p className="text-caption text-muted-foreground">MRR</p>
        </div>
      </div>
    </Card>
  );
}
