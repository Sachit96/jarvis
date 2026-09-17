import "server-only";

/**
 * Google OAuth2 + Calendar API v3 endpoints and scope, verified live
 * against current Google documentation before writing this:
 * - Authorization endpoint: https://accounts.google.com/o/oauth2/v2/auth
 * - Token endpoint: https://oauth2.googleapis.com/token
 * - Scope: the full `calendar` scope (not the narrower `calendar.events`)
 *   because connecting also creates a dedicated JARVIS calendar
 *   (calendars.insert), which calendar.events cannot do — it only covers
 *   events on calendars that already exist.
 *
 * A SEPARATE Google Cloud OAuth client from YouTube's, per the user's own
 * choice when asked — GOOGLE_CALENDAR_CLIENT_ID/SECRET, not
 * YOUTUBE_CLIENT_ID/SECRET.
 */
export const GOOGLE_CALENDAR_OAUTH_SCOPE = "https://www.googleapis.com/auth/calendar";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function getClientId(): string {
  const id = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CALENDAR_CLIENT_ID is not configured");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_CALENDAR_CLIENT_SECRET is not configured");
  return secret;
}

/**
 * redirect_uri is derived from the actual request origin (see the
 * /api/google-calendar/oauth/connect and /callback routes), not a
 * hardcoded env var — it must match a URI registered in Google Cloud
 * Console's OAuth client "Authorized redirect URIs" EXACTLY (scheme +
 * host + port + path), for both the production domain and
 * localhost:3000 if testing locally. The path itself is fixed:
 * /api/google-calendar/oauth/callback.
 */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_OAUTH_SCOPE,
    access_type: "offline", // required to get a refresh_token back, not just an access_token
    prompt: "consent", // forces the consent screen (and a fresh refresh_token) even on a returning user — needed since Testing-mode tokens expire in 7 days and reconnecting should always yield a new one
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
    throw new Error(`Google Calendar OAuth token exchange failed: ${res.status} ${res.statusText}`);
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
    throw new Error(
      `Google Calendar OAuth token refresh failed: ${res.status} ${res.statusText} — the connection may have expired; reconnect via Settings.`,
    );
  }
  return res.json();
}
