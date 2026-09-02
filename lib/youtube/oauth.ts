import "server-only";
import { TESTING_MODE_TOKEN_LIFETIME_DAYS } from "@/lib/youtube/constants";

/**
 * Google OAuth2 + YouTube Data API v3 endpoints and scope, verified live
 * against current Google documentation before writing this (not recalled
 * from training data):
 * - Authorization endpoint: https://accounts.google.com/o/oauth2/v2/auth
 * - Token endpoint: https://oauth2.googleapis.com/token
 * - Scope: youtube.upload covers both uploading (videos.insert) and
 *   managing videos you've uploaded (videos.update, needed for the
 *   approve-to-publish privacy flip) — deliberately not the broader
 *   `youtube` or `youtube.force-ssl` scopes, which also pull in
 *   comments/ratings/caption access this app never uses.
 */
export const YOUTUBE_OAUTH_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/**
 * QUOTA REALITY (flagged explicitly per the work order):
 * this app's own inherited assumption was "10,000 units/day total,
 * videos.insert costs 1,600 units, ~6 uploads/day." Verified live against
 * current Google documentation while building this and got a DIFFERENT,
 * inconsistent-with-that-assumption answer, twice: the current quota-cost
 * page states videos.insert has its own separate daily allocation —
 * "100 quota per day, each call costs 1 quota" — distinct from the
 * combined 10,000-unit pool for other endpoints, which would put the real
 * ceiling at up to 100 uploads/day, not 6. This is genuinely surprising
 * enough (and fetched via a summarizing pass over live docs, not a raw
 * quota-dashboard read) that it's not being treated as settled here —
 * this comment states BOTH numbers on purpose. Confirm the real ceiling
 * against your own project's actual quota dashboard
 * (console.cloud.google.com > APIs & Services > YouTube Data API v3 >
 * Quotas) once you're uploading for real, and update this comment with
 * whichever number your project's dashboard actually shows.
 */
export const UPLOAD_QUOTA_NOTE =
  "videos.insert: either ~1,600 units against a shared 10,000/day pool (~6 uploads/day) or a separate 100-calls/day allocation, per two different readings of Google's docs — verify against your project's actual quota dashboard.";

// TESTING_MODE_TOKEN_LIFETIME_DAYS lives in ./constants.ts (imported
// above), not here — this file is "server-only", and the Settings card
// (a "use client" component) needs that constant too.

function getClientId(): string {
  const id = process.env.YOUTUBE_CLIENT_ID;
  if (!id) throw new Error("YOUTUBE_CLIENT_ID is not configured");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!secret) throw new Error("YOUTUBE_CLIENT_SECRET is not configured");
  return secret;
}

/**
 * redirect_uri is derived from the actual request origin (see the
 * /api/youtube/oauth/connect and /callback routes), not a hardcoded env
 * var — it must match a URI registered in Google Cloud Console's OAuth
 * client "Authorized redirect URIs" EXACTLY (scheme + host + port +
 * path), for both the production domain and localhost:3000 if testing
 * locally. The path itself is fixed: /api/youtube/oauth/callback.
 */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_OAUTH_SCOPE,
    access_type: "offline", // required to get a refresh_token back, not just an access_token
    prompt: "consent", // forces the consent screen (and a fresh refresh_token) even on a returning user — needed since Testing-mode tokens expire in 7 days and re-connecting should always yield a new one
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    // Never log the response body — it can echo the client_secret's presence/absence and other request details.
    throw new Error(`YouTube OAuth token exchange failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Google only returns a new refresh_token on the FIRST exchange (or when prompt=consent forces re-issue) — a refresh call here returns a new access_token but not a new refresh_token; keep using the stored one. */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`YouTube OAuth token refresh failed: ${res.status} ${res.statusText} — the connection may have expired (Testing-mode refresh tokens last ${TESTING_MODE_TOKEN_LIFETIME_DAYS} days); reconnect via Settings.`);
  }
  return res.json();
}
