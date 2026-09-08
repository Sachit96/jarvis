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

export type PriorityDomain = "university" | "tasks" | "business" | "health" | "routine";

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
 * The ordering encodes one judgement: a hard external deadline that has
 * already passed outranks anything self-imposed, because it is the only
 * category where the cost of missing it is not the user's to negotiate.
 * Below that, things with a date beat things without one.
 */
const RANK = {
  overdueAssessment: 100,
  assessmentDueToday: 90,
  overdueTask: 80,
  assessmentDueSoon: 70,
  taskDueToday: 60,
  staleDeal: 50,
  routineIncomplete: 20,
} as const;

export interface PriorityInput {
  today: string;
  overdueTasks: { id: string; title: string; due_date: string | null }[];
  tasksDueToday: { id: string; title: string }[];
  /** Assessments and deadlines from the University module, ISO timestamps. */
  universityDue: { id: string; title: string; due_at: string; course?: string | null }[];
  staleDeals: { label: string; daysSinceStageChange: number }[];
  routine: { completed: number; total: number };
}

function dayDiff(fromIso: string, toDate: string): number {
  const a = new Date(`${toDate}T00:00:00`).getTime();
  const b = new Date(fromIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Every candidate, ranked. Returned in full (not just the winner) so the UI
 * can show the runners-up without recomputing, and so a test can assert the
 * ordering rather than only the top result.
 */
export function rankPriorities(input: PriorityInput): PriorityCandidate[] {
  const candidates: PriorityCandidate[] = [];

  for (const item of input.universityDue) {
    const days = dayDiff(item.due_at, input.today);
    const label = item.course ? `${item.course} — ${item.title}` : item.title;
    if (days < 0) {
      candidates.push({
        domain: "university",
        weight: RANK.overdueAssessment,
        headline: `${label} is overdue`,
        href: "/uni/assessments",
      });
    } else if (days === 0) {
      candidates.push({
        domain: "university",
        weight: RANK.assessmentDueToday,
        headline: `${label} is due today`,
        href: "/uni/assessments",
      });
    } else if (days <= 3) {
      candidates.push({
        domain: "university",
        weight: RANK.assessmentDueSoon,
        headline: `${label} is due in ${days} day${days === 1 ? "" : "s"}`,
        href: "/uni/assessments",
      });
    }
  }

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
