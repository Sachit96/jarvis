import { Dumbbell, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatLbs } from "@/lib/units";
import type { MuscleGroupVolume, PersonalRecord } from "@/lib/health/training";

function prDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Personal records and where the volume actually went.
 *
 * Both are derived from sets the page has already loaded (lib/health/training),
 * so this adds no queries — the numbers were sitting in the rows behind the
 * session list the whole time and nothing was reading them.
 */
export function TrainingInsights({
  records,
  byGroup,
}: {
  records: PersonalRecord[];
  byGroup: MuscleGroupVolume[];
}) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card padding="compact">
        <p className="eyebrow">Personal records</p>
        <p className="mt-1 text-caption text-foreground-tertiary">Heaviest set logged for each lift.</p>
        {records.length === 0 ? (
          <EmptyState
            compact
            icon={Trophy}
            title="No records yet"
            description="Log a set with a weight and reps and your best lift per exercise appears here."
          />
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {records.slice(0, 6).map((pr) => (
              <li key={pr.exerciseId} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-body text-foreground-secondary">{pr.exerciseName}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="tabular text-body font-medium text-foreground">
                    {formatLbs(pr.weightKg)} lbs × {pr.reps}
                  </span>
                  {prDate(pr.achievedAt) ? (
                    <span className="tabular text-caption text-foreground-tertiary">
                      {prDate(pr.achievedAt)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padding="compact">
        <p className="eyebrow">Volume by muscle group</p>
        <p className="mt-1 text-caption text-foreground-tertiary">
          Where the work went, all time. Weight × reps.
        </p>
        {byGroup.length === 0 ? (
          <EmptyState
            compact
            icon={Dumbbell}
            title="Nothing to split yet"
            description="Once sets are logged against exercises, the split by muscle group builds here."
          />
        ) : (
          <ul className="mt-3 space-y-3">
            {byGroup.slice(0, 6).map((row) => (
              <li key={row.group}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-body text-foreground-secondary capitalize">{row.group}</span>
                  <span className="tabular shrink-0 text-caption text-foreground-tertiary">
                    {formatLbs(row.volumeKg)} lbs · {row.setCount} set{row.setCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="gradient-brand h-full rounded-full" style={{ width: `${row.share}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
