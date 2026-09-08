import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "@/lib/integrations/brightspace/oauth";

/**
 * Stored Brightspace connection, and the access token that comes from it.
 *
 * Kept separate from index.ts so the resource functions never touch token
 * storage directly — they ask for a usable token and get one, or get null.
 * That is what lets the brightspace-lms package drop into index.ts later
 * without also inheriting the persistence concern.
 */

export interface StoredConnection {
  host: string;
  display_name: string | null;
  connected_at: string;
  last_synced_at: string | null;
  token_expires_at: string;
}

/** Refresh this far before actual expiry, so a long request cannot straddle it. */
const REFRESH_MARGIN_MS = 60_000;

export async function getConnection(): Promise<StoredConnection | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brightspace_connections")
    .select("host, display_name, connected_at, last_synced_at, token_expires_at")
    .maybeSingle();

  // A missing table (migration not applied) is indistinguishable here from
  // an unconfigured integration, and both mean the same thing to a caller:
  // there is no connection. Surfacing it as an error would turn a
  // not-set-up state into a crash on the Settings page.
  if (error || !data) return null;
  return data;
}

/**
 * A valid access token, refreshing first if it is about to expire.
 *
 * Returns null rather than throwing when there is no connection: "not
 * connected" is an expected state that every caller already handles through
 * the integration status system, not an exception.
 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brightspace_connections")
    .select("access_token, refresh_token, token_expires_at")
    .maybeSingle();
  if (error || !data) return null;

  const expiresAt = new Date(data.token_expires_at).getTime();
  if (Date.now() < expiresAt - REFRESH_MARGIN_MS) return data.access_token;

  try {
    const refreshed = await refreshAccessToken(data.refresh_token);
    await supabase.from("brightspace_connections").update({
      access_token: refreshed.access_token,
      // D2L may or may not rotate the refresh token; keeping the old one
      // when none comes back avoids blanking a still-valid credential.
      refresh_token: refreshed.refresh_token || data.refresh_token,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq("id", true);
    return refreshed.access_token;
  } catch {
    // A failed refresh means the grant was revoked or expired. Returning
    // null puts the integration back into a "needs reconnecting" state
    // rather than retrying a credential that will not start working.
    return null;
  }
}

export async function markSynced(): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("brightspace_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", true);
}

export async function disconnect(): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("brightspace_connections").delete().eq("id", true);
}
