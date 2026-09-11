/**
 * "What is the single most important thing right now?"
 *
 * Deliberately a deterministic ranking over real rows, not a model call.
 * Three reasons: Home renders on every visit and an LLM round trip per
 * render is slow and costly; the answer would change between two refreshes
 * with identical data; and a generated sentence can drift from what the
 * records actually say, which is precisely the "no fake dashboard numbers"
 * rule. Every candidate here points at a row that exists.
 *
 * The AI Mentor still writes the *narrative* brief. This is the one-line
 * headline, and it is auditable.
 *
 * Pure and clock-free — the caller passes today's date — so the ranking is
 * testable and cannot disagree with the modules it draws from.
 */

export type PriorityDomain = "tasks" | "business" | "health" | "routine";

export interface PriorityCandidate {
  domain: PriorityDomain;
  /** Higher wins. See RANK below for why these numbers are what they are. */
  weight: number;
  headline: string;
  /** Where to go to act on it. */
  href: string;
}

/**
 * Urgency bands, not arbitrary numbers.
 *
 * The ordering encodes one judgement: things with a date beat things
 * without one, and something already past its date beats something
 * approaching it.
 *
 * The top two bands used to belong to university assessments, on the
 * reasoning that an external deadline is the one category whose cost is
 * not the user's to negotiate. With that module gone the numbers simply
 * close up; the relative order of what remains is unchanged.
 */
const RANK = {
  overdueTask: 80,
  taskDueToday: 60,
  staleDeal: 50,
  routineIncomplete: 20,
} as const;

export interface PriorityInput {
  today: string;
  overdueTasks: { id: string; title: string; due_date: string | null }[];
  tasksDueToday: { id: string; title: string }[];
  staleDeals: { label: string; daysSinceStageChange: number }[];
  routine: { completed: number; total: number };
}

/**
 * Every candidate, ranked. Returned in full (not just the winner) so the UI
 * can show the runners-up without recomputing, and so a test can assert the
 * ordering rather than only the top result.
 */
export function rankPriorities(input: PriorityInput): PriorityCandidate[] {
  const candidates: PriorityCandidate[] = [];

  if (input.overdueTasks.length > 0) {
    const [first] = input.overdueTasks;
    const extra = input.overdueTasks.length - 1;
    candidates.push({
      domain: "tasks",
      weight: RANK.overdueTask,
      headline:
        extra > 0
          ? `"${first.title}" is overdue, plus ${extra} other${extra === 1 ? "" : "s"}`
          : `"${first.title}" is overdue`,
      href: "/life/tasks",
    });
  }

  if (input.tasksDueToday.length > 0) {
    const [first] = input.tasksDueToday;
    candidates.push({
      domain: "tasks",
      weight: RANK.taskDueToday,
      headline: `"${first.title}" is due today`,
      href: "/life/tasks",
    });
  }

  if (input.staleDeals.length > 0) {
    // Chase the one that has been silent longest, not an arbitrary one.
    const worst = [...input.staleDeals].sort(
      (a, b) => b.daysSinceStageChange - a.daysSinceStageChange,
    )[0];
    candidates.push({
      domain: "business",
      weight: RANK.staleDeal,
      headline: `${worst.label} has been quiet for ${worst.daysSinceStageChange} days`,
      href: "/business/pipeline",
    });
  }

  const remaining = input.routine.total - input.routine.completed;
  if (remaining > 0) {
    candidates.push({
      domain: "routine",
      weight: RANK.routineIncomplete,
      headline: `${remaining} routine item${remaining === 1 ? "" : "s"} left today`,
      href: "/life/habits",
    });
  }

  return candidates.sort((a, b) => b.weight - a.weight);
}

/**
 * The single headline, or null when there is genuinely nothing pressing.
 *
 * Returning null rather than inventing an encouragement matters: a
 * dashboard that always has something urgent to say trains the user to
 * ignore it, and "nothing is on fire" is real information.
 */
export function topPriority(input: PriorityInput): PriorityCandidate | null {
  return rankPriorities(input)[0] ?? null;
}
