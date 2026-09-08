import { KpiCell, KpiGrid } from "@/components/shared/kpi-grid";
import { DeltaBadge } from "@/components/shared/delta-badge";

function money(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10_000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Percentage change from `previous` to `current`.
 *
 * Returns null when there's no honest comparison to draw rather than
 * defaulting to 0% or 100%: with no prior month the change is unknown, not
 * flat, and a first month of spending is not a "+100% increase". Callers
 * render no badge at all in that case.
 */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export interface FinanceKpiInput {
  netWorth: number;
  availableCash: number;
  /** Total expenses in the current calendar month. */
  monthSpend: number;
  monthIncome: number;
  /** Same three figures for the previous calendar month, for the deltas. */
  previous: { spend: number; income: number };
}

export function FinanceKpis({
  netWorth,
  availableCash,
  monthSpend,
  monthIncome,
  previous,
}: FinanceKpiInput) {
  const spendDelta = pctChange(monthSpend, previous.spend);

  // Savings rate is a ratio, so its month-over-month move is already in
  // percentage points — subtracting is the honest comparison, where a
  // percent-change-of-a-percent ("savings rate up 40%!") would overstate a
  // move from 5% to 7%.
  const savingsRate = monthIncome > 0 ? ((monthIncome - monthSpend) / monthIncome) * 100 : null;
  const prevSavingsRate =
    previous.income > 0 ? ((previous.income - previous.spend) / previous.income) * 100 : null;
  const savingsDelta =
    savingsRate !== null && prevSavingsRate !== null ? savingsRate - prevSavingsRate : null;

  const netCashflow = monthIncome - monthSpend;

  return (
    <KpiGrid columns={4}>
      <KpiCell
        label="Net worth"
        accentClassName="text-cat-money"
        value={money(netWorth)}
        // No balance history is stored, so there is no true month-ago net
        // worth to compare against. This states the one thing that IS known
        // — the cashflow that moved it — instead of a fabricated percentage.
        hint={`${netCashflow >= 0 ? "+" : "−"}${money(Math.abs(netCashflow))} from this month's cashflow`}
      />

      <KpiCell
        label="Available cash"
        accentClassName="text-cat-money"
        value={money(availableCash)}
        hint="Cash and savings, excluding investments"
      />

      <KpiCell
        label="Monthly spend"
        accentClassName="text-cat-finance"
        value={money(monthSpend)}
        hint={previous.spend > 0 ? `${money(previous.spend)} last month` : "No prior month to compare"}
        action={
          spendDelta !== null ? <DeltaBadge percent={spendDelta} goodDirection="down" /> : undefined
        }
      />

      <KpiCell
        label="Savings rate"
        accentClassName="text-cat-goals"
        value={savingsRate === null ? "—" : `${savingsRate.toFixed(0)}%`}
        hint={
          savingsRate === null
            ? "Needs income logged this month"
            : prevSavingsRate === null
              ? "No prior month to compare"
              : `Was ${prevSavingsRate.toFixed(0)}% last month`
        }
        action={savingsDelta !== null ? <DeltaBadge percent={savingsDelta} unit="pp" /> : undefined}
      />
    </KpiGrid>
  );
}
