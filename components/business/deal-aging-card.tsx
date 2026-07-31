import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/database.types";

type Deal = Database["public"]["Tables"]["deals"]["Row"];

interface AgingBucket {
  label: string;
  count: number;
  value: number;
}

const BUCKET_DEFS = [
  { label: "0–7 days", max: 7 },
  { label: "8–14 days", max: 14 },
  { label: "15–30 days", max: 30 },
  { label: "30+ days", max: Infinity },
];

/**
 * Buckets open deals by age since creation — a plain function (not a
 * component) so the `Date.now()` read happens once in the page's request
 * handler, not inside a component render body (React's purity rules
 * disallow impure calls like Date.now() directly in render).
 */
export function computeDealAging(openDeals: Deal[]): AgingBucket[] {
  const now = Date.now();
  return BUCKET_DEFS.map((bucket, i) => {
    const min = i === 0 ? 0 : BUCKET_DEFS[i - 1].max;
    const deals = openDeals.filter((d) => {
      const ageDays = (now - new Date(d.created_at).getTime()) / 86400000;
      return ageDays >= min && ageDays < bucket.max;
    });
    return { label: bucket.label, count: deals.length, value: deals.reduce((s, d) => s + Number(d.value), 0) };
  });
}

function money(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** How long open deals have been sitting since creation — a real signal for what needs a follow-up. */
export function DealAgingCard({ openDealCount, buckets }: { openDealCount: number; buckets: AgingBucket[] }) {
  return (
    <Card>
      <p className="text-label uppercase tracking-wide text-muted-foreground">Deal Aging</p>
      <p className="mt-0.5 text-caption text-muted-foreground">How long open deals have sat since creation.</p>
      {openDealCount === 0 ? (
        <p className="mt-3 text-body text-muted-foreground">No open deals right now.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {buckets.map((b) => (
            <div key={b.label}>
              <p className={`font-mono text-heading font-bold ${b.label === "30+ days" && b.count > 0 ? "text-danger" : "text-foreground"}`}>
                {b.count}
              </p>
              <p className="text-caption text-muted-foreground">{b.label}</p>
              {b.count > 0 ? <p className="mt-0.5 font-mono text-caption text-muted-foreground">{money(b.value)}</p> : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
