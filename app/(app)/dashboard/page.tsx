import { StatTile } from "@/components/shared/stat-tile";
import { createClient } from "@/lib/supabase/server";
import { getAccounts, computeAssetLiabilityTotals } from "@/lib/db/queries/finance";

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const accounts = await getAccounts(supabase);
  const { netWorth } = computeAssetLiabilityTotals(accounts);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="text-sm text-muted-foreground">
          Your cross-module command center.
        </p>
      </div>

      <div className="rounded-lg border border-brand/40 bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-brand">
          Mentor&apos;s take
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Coming in Phase 5 — the AI Mentor reads every module below and
          surfaces a daily recommendation here.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Life" value="—" delta="Phase 1" />
        <StatTile
          label="Finance"
          value={accounts.length > 0 ? money(netWorth) : "—"}
          delta={accounts.length > 0 ? "Net worth" : "Phase 2"}
          tone={netWorth >= 0 ? "success" : "danger"}
        />
        <StatTile label="Health" value="—" delta="Phase 3" />
        <StatTile label="Business" value="—" delta="Phase 4" />
      </div>
    </div>
  );
}
