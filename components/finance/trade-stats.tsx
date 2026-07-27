import { StatTile } from "@/components/shared/stat-tile";

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TradeStats({
  totalPnl,
  winRate,
  closedCount,
  openCount,
}: {
  totalPnl: number;
  winRate: number;
  closedCount: number;
  openCount: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Total PnL"
        value={money(totalPnl)}
        tone={totalPnl >= 0 ? "success" : "danger"}
      />
      <StatTile label="Win Rate" value={`${winRate.toFixed(0)}%`} />
      <StatTile label="Closed Trades" value={String(closedCount)} />
      <StatTile label="Open Trades" value={String(openCount)} />
    </div>
  );
}
