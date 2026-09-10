import { PieChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

interface AccountLike {
  id: string;
  name: string;
  account_type: string;
  current_balance: number;
  is_liability: boolean | null;
}

const TYPE_LABEL: Record<string, string> = {
  checking: "Cash",
  savings: "Savings",
  investment: "Investments",
  credit: "Credit",
  loan: "Loans",
};

function money(n: number) {
  if (Math.abs(n) >= 10_000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Where the assets actually sit, by account type.
 *
 * Liabilities are excluded rather than shown as negative slices: an
 * allocation answers "how is what I own distributed", and mixing debt into
 * that produces shares that do not mean anything. Net worth, which does net
 * the two, is already the headline figure above this.
 */
export function AllocationCard({ accounts }: { accounts: AccountLike[] }) {
  const assets = accounts.filter((a) => !a.is_liability && Number(a.current_balance) > 0);
  const total = assets.reduce((sum, a) => sum + Number(a.current_balance), 0);

  const byType = new Map<string, number>();
  for (const account of assets) {
    const key = TYPE_LABEL[account.account_type] ?? account.account_type;
    byType.set(key, (byType.get(key) ?? 0) + Number(account.current_balance));
  }
  const rows = [...byType.entries()]
    .map(([label, value]) => ({ label, value, share: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  return (
    <Card padding="slotted">
      <div className="px-(--card-spacing)">
        <p className="eyebrow">Allocation</p>
        <p className="mt-1 text-caption text-foreground-tertiary">
          Assets by account type. Liabilities are netted into net worth, not shown here.
        </p>
      </div>

      <div className="px-(--card-spacing)">
        {rows.length === 0 ? (
          <EmptyState
            compact
            icon={PieChart}
            title="Nothing allocated"
            description="Connect an account with a positive balance and its share appears here."
          />
        ) : (
          <>
            {/* One stacked bar rather than a donut: five categories on a
                narrow card read better as proportions of a line than as
                wedges, and it costs no chart library. */}
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              {rows.map((row, i) => (
                <div
                  key={row.label}
                  title={`${row.label}: ${money(row.value)}`}
                  style={{
                    width: `${row.share}%`,
                    backgroundColor: `var(--chart-${(i % 6) + 1})`,
                  }}
                />
              ))}
            </div>
            <ul className="mt-4 space-y-2.5">
              {rows.map((row, i) => (
                <li key={row.label} className="flex items-center justify-between gap-3 text-body">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(--chart-${(i % 6) + 1})` }}
                    />
                    <span className="truncate text-foreground-secondary">{row.label}</span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="tabular font-medium text-foreground">{money(row.value)}</span>
                    <span className="tabular w-10 text-right text-caption text-foreground-tertiary">
                      {row.share.toFixed(0)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
