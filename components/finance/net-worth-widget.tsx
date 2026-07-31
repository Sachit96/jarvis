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
}: {
  assets: number;
  liabilities: number;
  netWorth: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <StatTile
        label="Net Worth"
        value={money(netWorth)}
        delta={netWorth >= 0 ? "Positive" : "Negative"}
        tone={netWorth >= 0 ? "success" : "danger"}
        trend={netWorth >= 0 ? "up" : "down"}
        primary
        icon={Wallet}
        category="money"
        className="col-span-3 sm:col-span-1"
      />
      <StatTile label="Total Assets" value={money(assets)} icon={TrendingUp} category="money" />
      <StatTile label="Total Liabilities" value={money(liabilities)} icon={TrendingDown} category="finance" />
    </div>
  );
}
