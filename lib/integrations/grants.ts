import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getYtConnection } from "@/lib/db/queries/youtube";
import { getConnection as getBrightspaceConnection } from "@/lib/integrations/brightspace/connection";
import { getIntegrationStatuses, type IntegrationStatus } from "@/lib/integrations/status";

/**
 * Integration statuses upgraded with whether an OAuth grant actually exists.
 *
 * status.ts answers "could this work" from environment variables alone, and
 * must stay synchronous — it runs on every page render and every AI turn.
 * But for the two OAuth integrations, env vars only prove an app is
 * REGISTERED. A registered app with nobody signed in cannot upload a video or
 * read a course, and reporting it as connected is the precise failure mode of
 * "connected because the adapter exists".
 *
 * So this is the async counterpart: one database read per OAuth integration,
 * for the surfaces that genuinely need the distinction (Settings). Everything
 * that only needs "should I offer this feature" keeps using the sync version.
 */
export async function getIntegrationStatusesWithGrants(): Promise<IntegrationStatus[]> {
  const base = getIntegrationStatuses();

  // Only worth a query when an app is registered at all: with no client
  // credentials a stored token cannot be used even if a stale row exists.
  const needsYouTube = base.find((s) => s.id === "youtube")?.state === "disconnected";
  const needsBrightspace = base.find((s) => s.id === "brightspace")?.state === "disconnected";

  // The client is built only when a lookup is actually going to happen, so a
  // page with no OAuth app registered pays nothing for this.
  const [youtube, brightspace] = await Promise.all([
    needsYouTube ? getYtConnection(createAdminClient()).catch(() => null) : Promise.resolve(null),
    needsBrightspace ? getBrightspaceConnection().catch(() => null) : Promise.resolve(null),
  ]);

  return base.map((status) => {
    if (status.id === "youtube" && youtube) {
      return {
        ...status,
        state: "connected" as const,
        message: "YouTube is connected and uploads are authorised.",
        actionHint: undefined,
      };
    }
    if (status.id === "brightspace" && brightspace) {
      return {
        ...status,
        state: "connected" as const,
        message: brightspace.display_name
          ? `Connected as ${brightspace.display_name}.`
          : "Connected.",
        actionHint: brightspace.last_synced_at
          ? undefined
          : "Connected, but nothing has been synced yet.",
      };
    }
    return status;
  });
}
