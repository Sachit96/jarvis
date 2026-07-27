import { cn } from "@/lib/utils";

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MonthlyPnlCard({
  income,
  expense,
  net,
}: {
  income: number;
  expense: number;
  net: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        This month&apos;s P&amp;L
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Income</p>
          <p className="font-mono text-lg text-success">{money(income)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Expenses</p>
          <p className="font-mono text-lg text-danger">{money(expense)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Net Cashflow</p>
          <p className={cn("font-mono text-lg", net >= 0 ? "text-success" : "text-danger")}>
            {money(net)}
          </p>
        </div>
      </div>
    </div>
  );
}
