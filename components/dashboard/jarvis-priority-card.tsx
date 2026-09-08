import Link from "next/link";
import { ArrowRight, CircleCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PriorityCandidate, PriorityDomain } from "@/lib/life/priority";

/**
 * The one-line headline at the top of Home.
 *
 * Every word of this comes from a ranking over real rows (lib/life/priority)
 * — no model call, so it cannot drift from what the records say and cannot
 * change between two refreshes of identical data. The AI Mentor still writes
 * the narrative brief; this is the auditable headline.
 */

const DOMAIN_TINT: Record<PriorityDomain, string> = {
  university: "text-cat-goals",
  tasks: "text-brand",
  business: "text-cat-business",
  health: "text-cat-health",
  routine: "text-cat-habits",
};

export function JarvisPriorityCard({
  priority,
  runnersUp,
}: {
  priority: PriorityCandidate | null;
  runnersUp: PriorityCandidate[];
}) {
  // "Nothing is on fire" is real information. Inventing an urgency here
  // would train the user to ignore this line entirely.
  if (!priority) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-card px-5 py-4 ring-1 ring-border">
        <CircleCheck className="size-5 shrink-0 text-success" strokeWidth={2} />
        <div>
          <p className="text-label uppercase tracking-wide text-muted-foreground">JARVIS priority</p>
          <p className="text-body">Nothing overdue or due today. Good place to get ahead.</p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={priority.href}
      className="block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="group flex items-start gap-3 rounded-2xl bg-card px-5 py-4 ring-1 ring-border transition-colors hover:ring-white/[0.14]">
        <Zap
          className={cn("mt-0.5 size-5 shrink-0", DOMAIN_TINT[priority.domain])}
          strokeWidth={2}
        />
        <div className="min-w-0 flex-1">
          <p className="text-label uppercase tracking-wide text-muted-foreground">JARVIS priority</p>
          <p className="text-body font-medium">{priority.headline}</p>
          {runnersUp.length > 0 ? (
            <p className="mt-1 truncate text-caption text-muted-foreground">
              Then: {runnersUp.map((r) => r.headline).join(" · ")}
            </p>
          ) : null}
        </div>
        <ArrowRight
          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </div>
    </Link>
  );
}
