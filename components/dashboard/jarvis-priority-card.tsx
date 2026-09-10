import Link from "next/link";
import { ArrowRight, CircleCheck, Zap } from "lucide-react";
import { RadarMark } from "@/components/shell/radar-mark";
import type { PriorityCandidate } from "@/lib/life/priority";

/**
 * The one-line headline at the top of Home.
 *
 * Every word of this comes from a ranking over real rows (lib/life/priority)
 * — no model call, so it cannot drift from what the records say and cannot
 * change between two refreshes of identical data. The AI Mentor still writes
 * the narrative brief; this is the auditable headline.
 *
 * This is the single most important panel on the command centre, so it is
 * the one card in the app that gets `surface-lit` — brand light pooled
 * behind the glass — plus the radar, at the one place per screen the motif
 * is allowed to sweep. Everything else on Home is deliberately a step below
 * it; if a second panel here were lit, neither would read as the answer.
 *
 * The leading icon used to be tinted per domain from the category palette,
 * which meant the most prominent element on the dashboard changed colour
 * depending on which module happened to be shouting loudest — five different
 * accent colours for one component.
 */
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
      <div className="surface flex items-center gap-3.5 px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-success">
          <CircleCheck className="size-[18px]" strokeWidth={2} />
        </span>
        <div>
          <p className="eyebrow">JARVIS priority</p>
          <p className="mt-1 text-body text-foreground-secondary">
            Nothing overdue or due today. Good place to get ahead.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={priority.href}
      className="group block rounded-[var(--radius)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="surface-lit relative flex items-center gap-4 overflow-hidden px-5 py-4">
        {/* The radar sits inside the panel, half off its right edge: present
            as identity, never as an illustration competing with the line of
            text that is the actual point. */}
        <RadarMark
          size={150}
          className="pointer-events-none absolute -top-8 right-6 opacity-[0.45] max-md:hidden"
        />

        <span className="gradient-brand flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-[0_0_24px_-6px_var(--brand)]">
          <Zap className="size-5" strokeWidth={2} />
        </span>

        <div className="relative min-w-0 flex-1">
          <p className="eyebrow">JARVIS priority</p>
          <p className="mt-1 truncate text-heading text-foreground">{priority.headline}</p>
          {runnersUp.length > 0 ? (
            <p className="mt-1 truncate text-caption text-foreground-tertiary">
              Then: {runnersUp.map((r) => r.headline).join(" · ")}
            </p>
          ) : null}
        </div>

        <ArrowRight
          className="relative size-4 shrink-0 text-foreground-tertiary transition-transform group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </div>
    </Link>
  );
}
