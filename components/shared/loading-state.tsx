import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shape a module wears while its data is in flight.
 *
 * Deliberately mirrors the layout it stands in for — a header, a KPI band,
 * then panels — rather than being a generic spinner. A skeleton that matches
 * the page it precedes makes the load feel like the page arriving; a spinner
 * in the middle of an empty screen makes it feel like a wait.
 *
 * Route-level `loading.tsx` files render this, so navigation always has
 * something considered on screen instead of the previous page hanging.
 */
export function LoadingState({
  kpis = 4,
  panels = 2,
  className,
}: {
  /** How many cells the KPI band has. 0 hides the band. */
  kpis?: number;
  /** How many content panels sit under it. */
  panels?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)} aria-busy role="status">
      <span className="sr-only">Loading…</span>

      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-56" />
      </div>

      {kpis > 0 ? (
        <div className="surface grid grid-cols-2 overflow-hidden xl:grid-cols-4">
          {Array.from({ length: kpis }).map((_, i) => (
            <div key={i} className="space-y-3 border-r border-b border-border p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {Array.from({ length: panels }).map((_, i) => (
          <div key={i} className="surface space-y-3 p-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-40 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
