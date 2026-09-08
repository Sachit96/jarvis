import "server-only";

/**
 * Brightspace (D2L Valence) OAuth2 — authorization code flow.
 *
 * Shapes follow richardantao/brightspace-lms-js, which is MIT and should
 * replace these hand-rolled calls once the sandbox allows installing it.
 * The flow itself is standard OAuth2, so this is deliberately thin: the
 * value of the package is its resource layer and version negotiation, not
 * the token exchange.
 *
 * NO PASSWORDS. There is no path here that accepts a user credential —
 * only an authorization code the institution's own login issued.
 *
 * D2L's authorization server is a single shared host, not the institution's
 * host: the institution is identified by the client_id, and the tenant host
 * is only used for API calls afterwards.
 */

const AUTH_HOST = "https://auth.brightspace.com";

/** Read-only. This integration reads coursework; it never submits on the user's behalf. */
export const SCOPES = "core:*:* grades:*:read enrollment:*:read content:*:read";

export interface BrightspaceTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export function isConfigured(): boolean {
  return Boolean(
    process.env.BRIGHTSPACE_HOST &&
      process.env.BRIGHTSPACE_CLIENT_ID &&
      process.env.BRIGHTSPACE_CLIENT_SECRET,
  );
}

/**
 * Returns null rather than a half-formed URL when the app is not
 * registered, so a Connect button can render disabled with a reason
 * instead of sending the user to a broken authorize page.
 */
export function buildAuthUrl(redirectUri: string, state: string): string | null {
  const clientId = process.env.BRIGHTSPACE_CLIENT_ID;
  if (!clientId) return null;

  const url = new URL("/oauth2/auth", AUTH_HOST);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(body: URLSearchParams): Promise<BrightspaceTokens> {
  const clientId = process.env.BRIGHTSPACE_CLIENT_ID;
  const clientSecret = process.env.BRIGHTSPACE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Brightspace OAuth is not configured");
  }

  const response = await fetch(`${AUTH_HOST}/core/connect/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Client credentials go in the Authorization header, never in the
      // body and never in a redirect URL — the secret must not be able to
      // end up in a browser history or a server log line.
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // Truncated: the body can be a full HTML error page, and the whole
    // thing would end up in a log line or a redirect parameter.
    throw new Error(`Brightspace token request failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const json = (await response.json()) as Partial<BrightspaceTokens>;
  if (!json.access_token) throw new Error("Brightspace returned no access token");
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? "",
    expires_in: json.expires_in ?? 3600,
    scope: json.scope ?? SCOPES,
  };
}

export function exchangeCodeForTokens(code: string, redirectUri: string): Promise<BrightspaceTokens> {
  return tokenRequest(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  );
}

export function refreshAccessToken(refreshToken: string): Promise<BrightspaceTokens> {
  return tokenRequest(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  );
}
