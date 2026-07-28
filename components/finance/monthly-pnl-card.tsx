import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

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
    <Card>
      <p className="text-label uppercase tracking-wide text-muted-foreground">This month&apos;s P&amp;L</p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <p className="text-caption uppercase text-muted-foreground">Income</p>
          <p className="mt-0.5 font-mono text-heading text-success">{money(income)}</p>
        </div>
        <div>
          <p className="text-caption uppercase text-muted-foreground">Expenses</p>
          <p className="mt-0.5 font-mono text-heading text-danger">{money(expense)}</p>
        </div>
        <div>
          <p className="text-caption uppercase text-muted-foreground">Net Cashflow</p>
          <p className={cn("mt-0.5 font-mono text-heading", net >= 0 ? "text-success" : "text-danger")}>
            {money(net)}
          </p>
        </div>
      </div>
    </Card>
  );
}
