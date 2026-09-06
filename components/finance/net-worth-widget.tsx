import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { StatTile } from "@/components/shared/stat-tile";

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function NetWorthWidget({
  assets,
  liabilities,
  netWorth,
  accountCount,
}: {
  assets: number;
  liabilities: number;
  netWorth: number;
  /** When 0, these are real zeros with nothing behind them yet, not a measured net worth of $0 — see the account list's own "No accounts yet" empty state below this widget. */
  accountCount: number;
}) {
  const noAccounts = accountCount === 0;
  return (
    <div className="grid grid-cols-3 gap-4">
      <StatTile
        label="Net Worth"
        value={money(netWorth)}
        delta={noAccounts ? undefined : netWorth >= 0 ? "Positive" : "Negative"}
        tone={netWorth >= 0 ? "success" : "danger"}
        trend={noAccounts ? undefined : netWorth >= 0 ? "up" : "down"}
        primary={!noAccounts}
        icon={Wallet}
        category="money"
        className="col-span-3 sm:col-span-1"
        unmeasured={noAccounts}
        note={noAccounts ? "No accounts connected yet" : undefined}
      />
      <StatTile label="Total Assets" value={money(assets)} icon={TrendingUp} category="money" unmeasured={noAccounts} />
      <StatTile label="Total Liabilities" value={money(liabilities)} icon={TrendingDown} category="finance" unmeasured={noAccounts} />
    </div>
  );
}
