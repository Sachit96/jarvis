import "server-only";

/**
 * How a user's approval is spent.
 *
 * Lifted out of the agent loop for the same reason as tool-round.ts: this is
 * the security-critical rule, and inside a closure it was only reachable by
 * mocking a model. Two properties matter, and both are ways an approval could
 * be turned into something the user never agreed to:
 *
 *   1. An approval authorises ONE execution. A model that proposes deleting
 *      two tasks must not ride a single "yes" into both.
 *   2. The approved ARGUMENTS win over whatever the model re-emits. The
 *      confirmation prompt showed the user specific arguments; if the model
 *      then proposes different ones under the same tool name, running those
 *      would execute an action the user never saw.
 *
 * Modelled as a value that is consumed rather than a mutable flag, so
 * "already spent" is represented in the return value instead of relying on
 * every caller remembering to clear it.
 */

export interface ApprovedCall {
  toolName: string;
  args: Record<string, unknown>;
}

export interface ApprovalDecision {
  /** What to actually execute — the approved arguments when one applied. */
  args: Record<string, unknown>;
  /** The executor's risk gate opens only on this. The model cannot set it. */
  confirmed: boolean;
  /** The approval still available to later calls; undefined once spent. */
  remaining: ApprovedCall | undefined;
}

export function applyApproval(
  pending: ApprovedCall | undefined,
  call: { name: string; args: Record<string, unknown> },
): ApprovalDecision {
  // Matched by tool name: an approval to delete a task is not an approval to
  // send an SMS, however the model labels the call.
  if (!pending || pending.toolName !== call.name) {
    return { args: call.args, confirmed: false, remaining: pending };
  }

  return { args: { ...pending.args }, confirmed: true, remaining: undefined };
}
