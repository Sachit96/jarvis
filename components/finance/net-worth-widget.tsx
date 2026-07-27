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
    <div className="grid grid-cols-3 gap-3">
      <StatTile
        label="Net Worth"
        value={money(netWorth)}
        tone={netWorth >= 0 ? "success" : "danger"}
        className="col-span-3 sm:col-span-1"
      />
      <StatTile label="Total Assets" value={money(assets)} tone="success" />
      <StatTile label="Total Liabilities" value={money(liabilities)} tone={liabilities > 0 ? "danger" : "neutral"} />
    </div>
  );
}
