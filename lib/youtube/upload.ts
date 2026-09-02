import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "@/lib/youtube/oauth";

const UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/youtube/v3/videos";
const VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";

type Connection = { access_token: string; refresh_token: string; token_expires_at: string };

/** Refreshes the stored access token if it's expired (or close to it), persisting the new one — every upload/publish call goes through this first rather than assuming the stored token is still good. */
async function getValidAccessToken(connection: Connection): Promise<string> {
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const bufferMs = 60_000; // refresh a minute early rather than racing an actual expiry
  if (Date.now() < expiresAt - bufferMs) return connection.access_token;

  const refreshed = await refreshAccessToken(connection.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  const supabase = createAdminClient();
  await supabase.from("yt_connections").update({ access_token: refreshed.access_token, token_expires_at: newExpiresAt }).eq("id", true);

  return refreshed.access_token;
}

export interface UploadVideoInput {
  title: string;
  description: string;
  videoBytes: Uint8Array;
  mimeType: string;
}

export interface UploadVideoResult {
  videoId: string;
}

/**
 * videos.insert via the "multipart" upload type — a single request
 * combining the metadata JSON and the video binary in one
 * multipart/related body (RFC 2387), not the "resumable" upload type.
 * Resumable is what Google recommends for large files or flaky
 * connections (chunked, resumable session), but is meaningfully more
 * implementation complexity (a session-init request, then chunked PUTs
 * with Content-Range headers, retry/resume bookkeeping) — multipart is a
 * deliberate simplicity tradeoff for a personal, single-user tool
 * uploading occasional videos, not a production video pipeline. Revisit
 * if uploads start timing out on larger files.
 *
 * privacyStatus is always "private" here — never anything else. Making a
 * video public is exclusively approveToPublish()'s job (videos.update),
 * a separate explicit action, never a parameter this function accepts.
 */
export async function uploadVideo(connection: Connection, input: UploadVideoInput): Promise<UploadVideoResult> {
  const accessToken = await getValidAccessToken(connection);

  const metadata = {
    snippet: { title: input.title, description: input.description },
    status: { privacyStatus: "private" },
  };

  const boundary = `jarvis_yt_upload_${Date.now()}`;
  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const videoPartHeader = `--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const body = Buffer.concat([Buffer.from(metadataPart, "utf8"), Buffer.from(videoPartHeader, "utf8"), Buffer.from(input.videoBytes), Buffer.from(closing, "utf8")]);

  const res = await fetch(`${UPLOAD_ENDPOINT}?uploadType=multipart&part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`YouTube upload failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return { videoId: data.id };
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
