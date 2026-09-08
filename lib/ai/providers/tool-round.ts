import "server-only";
import type { AgentToolCall, AgentToolOutcome } from "@/lib/ai/providers/types";

/**
 * Executes the tool calls the model asked for in a single round.
 *
 * Lifted out of the provider so the scheduling rule can be tested without a
 * network round trip — the rule is the interesting part, and it was
 * previously reachable only by mocking the model.
 *
 * The rule: a round of purely parallel-safe calls runs concurrently;
 * anything else runs in order.
 *
 * Reads in a round are independent — "what's on today" fans out to tasks,
 * calendar, deadlines and follow-ups, none of which depends on another's
 * result — so running them concurrently turns four sequential waits into
 * one. Writes stay ordered because two writes in a round genuinely can
 * depend on each other (create a task, then complete it), and concurrency
 * would make the outcome depend on which finished first.
 *
 * The caller supplies `parallelSafe` because risk lives in the registry, not
 * here, and it defaults to "not safe" so the conservative behaviour is what
 * you get by forgetting to pass it.
 */
export async function runToolRound(
  calls: AgentToolCall[],
  execute: (call: AgentToolCall) => Promise<AgentToolOutcome>,
  parallelSafe: (name: string) => boolean = () => false,
): Promise<AgentToolOutcome[]> {
  const canParallelise = calls.length > 1 && calls.every((c) => parallelSafe(c.name));

  if (canParallelise) {
    return Promise.all(calls.map((call) => execute(call)));
  }

  const outcomes: AgentToolOutcome[] = [];
  for (const call of calls) {
    const outcome = await execute(call);
    outcomes.push(outcome);
    // Once a call needs confirmation the rest of the round is moot, and
    // running it anyway would perform work the user is still being asked
    // about.
    if (outcome.halt) break;
  }
  return outcomes;
}
