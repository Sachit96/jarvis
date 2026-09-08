import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Spending by category is a ranked-magnitude comparison, which is a bar's
 * job, not a donut's — a donut asks the reader to compare arc lengths, and
 * the two or three categories that actually matter are usually close enough
 * that arcs can't separate them.
 *
 * Bars also make the color question disappear. Every bar measures the same
 * thing, so one hue carries it; the previous donut needed five categorical
 * colors purely because slices touch, and cycled them once the list grew
 * past five, which silently gave two different categories the same color.
 *
 * Rendered as plain elements rather than Recharts: at this size a bar list
 * is a flex row with a percentage width, and doing it directly keeps the
 * card a server component, keeps the labels real selectable text, and
 * avoids shipping a chart runtime for five rows.
 */
const MAX_ROWS = 6;

export function SpendByCategoryChart({ spendByCategory }: { spendByCategory: Map<string, number> }) {
  const all = [...spendByCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Everything past the cut folds into one "Other" row rather than being
  // dropped — otherwise the rows don't sum to the total shown above them.
  const head = all.slice(0, MAX_ROWS);
  const tail = all.slice(MAX_ROWS);
  const rows =
    tail.length > 0
      ? [...head, { category: `Other (${tail.length})`, amount: tail.reduce((s, r) => s + r.amount, 0) }]
      : head;

  const total = all.reduce((sum, r) => sum + r.amount, 0);
  // Bars are scaled against the largest row, not the total: against the
  // total, a realistic spread leaves every bar a short stub and the ranking
  // becomes hard to read.
  const max = rows.length > 0 ? Math.max(...rows.map((r) => r.amount)) : 0;

  return (
    <Card padding="slotted" className="h-full">
      <CardHeader>
        <CardTitle>Spending by category</CardTitle>
        <CardDescription>
          {total > 0
            ? `$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} this month`
            : "This month"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-body text-muted-foreground">
            No expenses logged this month yet.
          </div>
        ) : (
          <ul className="space-y-3.5">
            {rows.map((row) => {
              const share = total > 0 ? (row.amount / total) * 100 : 0;
              return (
                <li key={row.category} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-body">{row.category}</span>
                    <span className="tabular shrink-0 text-body text-muted-foreground">
                      ${row.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span className="ml-1.5 text-caption">{share.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-cat-finance"
                      style={{ width: `${max > 0 ? Math.max((row.amount / max) * 100, 2) : 0}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
