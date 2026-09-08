import "server-only";
import { getIntegrationStatus, isUsable, type IntegrationStatus } from "@/lib/integrations/status";
import { hasHevyKey, listRecentHevyWorkouts, type HevyWorkout } from "@/lib/integrations/hevy/client";

/**
 * The Hevy adapter's public face.
 *
 * client.ts is unchanged — it already spoke the v1 API correctly, with the
 * api-key header quirk documented against the real spec, so rewriting it
 * against the `hevy-api` package would have thrown away verified behaviour
 * to gain a dependency. What was missing was a boundary: callers reached
 * straight for hasHevyKey() and a raw fetch helper, so every one of them had
 * to remember what an unconfigured key meant.
 *
 * Everything here returns a result carrying the integration's status rather
 * than throwing or returning an empty array, because "no workouts" and
 * "cannot ask" are different answers and the caller — a page, a tool, or the
 * model — has to be able to tell them apart.
 */

export interface HevyResult<T> {
  status: IntegrationStatus;
  /** Present only when status is usable AND the call succeeded. */
  data?: T;
  /** Set when the call itself failed, as opposed to not being configured. */
  failure?: string;
}

export function getHevyStatus(): IntegrationStatus {
  const base = getIntegrationStatus("hevy");
  // Cross-check against the client's own predicate rather than duplicating
  // the env lookup, so the two can never disagree about what "configured"
  // means.
  if (hasHevyKey() && base.state !== "connected") {
    return { ...base, state: "connected", message: "Workout sync is configured." };
  }
  return base;
}

/**
 * Recent workouts straight from Hevy.
 *
 * Note this is the live API, not the synced copy in Supabase — pages should
 * keep reading the database (which works with or without Hevy) and use this
 * only when they specifically need to know what Hevy itself holds.
 */
export async function fetchRecentWorkouts(pageSize = 10): Promise<HevyResult<HevyWorkout[]>> {
  const status = getHevyStatus();
  if (!isUsable(status.state)) return { status };

  try {
    return { status, data: await listRecentHevyWorkouts(pageSize) };
  } catch (error) {
    // A configured integration that fails is a different state from one that
    // was never set up, and the user needs to be told which — a 401 means
    // the key is wrong, not that they should go get a key.
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      status: {
        ...status,
        state: "error",
        message: "Hevy is configured but the last request failed.",
        actionHint: "Check that HEVY_API_KEY is still valid and that the Pro subscription is active.",
      },
      failure: message,
    };
  }
}
