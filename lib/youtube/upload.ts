import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "@/lib/youtube/oauth";

const RESUMABLE_INIT_ENDPOINT = "https://www.googleapis.com/upload/youtube/v3/videos";
const VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";

type Connection = { access_token: string; refresh_token: string; token_expires_at: string };

/**
 * Refreshes the stored access token if it's expired (or close to it), persisting the new one — every upload/publish call goes through this first rather than assuming the stored token is still good. Exported (was private) — the resumable-upload flow's session-initiation step needs a valid token too, and per initiateResumableSession's own comment, so does the browser for the direct-to-YouTube PUT that follows it.
 */
export async function getValidAccessToken(connection: Connection): Promise<string> {
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const bufferMs = 60_000; // refresh a minute early rather than racing an actual expiry
  if (Date.now() < expiresAt - bufferMs) return connection.access_token;

  const refreshed = await refreshAccessToken(connection.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  const supabase = createAdminClient();
  await supabase.from("yt_connections").update({ access_token: refreshed.access_token, token_expires_at: newExpiresAt }).eq("id", true);

  return refreshed.access_token;
}

export interface InitiateResumableInput {
  title: string;
  description: string;
  fileSizeBytes: number;
  mimeType: string;
}

export interface ResumableSession {
  sessionUri: string;
  /**
   * Handed to the BROWSER so it can PUT the video bytes directly to
   * `sessionUri` — YouTube's resumable upload protocol requires
   * `Authorization: Bearer <token>` on that PUT too (verified against
   * Google's current docs before building this), not just on this
   * session-initiation call, and there's no way to pre-authorize the
   * session URI itself to skip that. This is the deliberate point of the
   * whole rebuild: routing an access token to the client, once, for a
   * request the client makes directly to googleapis.com, is the tradeoff
   * that lets video BYTES skip this app's own backend entirely — the
   * alternative (proxying the bytes through a Server Action, the old
   * approach) is what hit Netlify's real ~6MB function body ceiling
   * regardless of the 100MB Next.js config, and would keep hitting it no
   * matter how the proxy were written. Access tokens here are short-lived
   * (Google's standard ~1hr expiry) and scoped to youtube.upload only
   * (see oauth.ts's YOUTUBE_OAUTH_SCOPE) — acceptable for a single-user
   * personal app; never logged, never persisted client-side, used exactly
   * once for the PUT that immediately follows.
   */
  accessToken: string;
}

/**
 * Step 1 of YouTube's resumable upload protocol (developers.google.com/
 * youtube/v3/guides/using_resumable_upload_protocol, verified against
 * that page before building this, not recalled) — a small, metadata-only
 * POST (no video bytes) that returns a session URI in the response's
 * Location header. Step 2 (the actual byte PUT to that URI) happens
 * entirely client-side — see ResumableSession's own comment for why.
 *
 * privacyStatus is always "private" here — never anything else, same
 * invariant the old uploadVideo() enforced. Making a video public stays
 * exclusively setVideoPublic()'s job below, a separate explicit action.
 */
export async function initiateResumableSession(connection: Connection, input: InitiateResumableInput): Promise<ResumableSession> {
  const accessToken = await getValidAccessToken(connection);

  const metadata = {
    snippet: { title: input.title, description: input.description },
    status: { privacyStatus: "private" },
  };

  const res = await fetch(`${RESUMABLE_INIT_ENDPOINT}?uploadType=resumable&part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(input.fileSizeBytes),
      "X-Upload-Content-Type": input.mimeType,
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    throw new Error(`YouTube resumable session init failed: ${res.status} ${res.statusText}`);
  }
  const sessionUri = res.headers.get("Location");
  if (!sessionUri) {
    throw new Error("YouTube didn't return a resumable session URI (missing Location header)");
  }
  return { sessionUri, accessToken };
}

/** The ONLY path in this app that makes a video public — videos.update with part=status. Never called automatically; only from the explicit "Approve to publish" action, which exists specifically so no upload goes public without a real click. */
export async function setVideoPublic(connection: Connection, videoId: string): Promise<void> {
  const accessToken = await getValidAccessToken(connection);
  const res = await fetch(`${VIDEOS_ENDPOINT}?part=status`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: videoId, status: { privacyStatus: "public" } }),
  });
  if (!res.ok) {
    throw new Error(`YouTube publish (videos.update) failed: ${res.status} ${res.statusText}`);
  }
}
