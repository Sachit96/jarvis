import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { buildAuthUrl } from "@/lib/integrations/brightspace/oauth";

// Starts the Brightspace OAuth flow — the Settings card links here.
// redirect_uri is derived from the incoming request's own origin rather
// than a hardcoded env var, so this works identically on localhost and in
// production, provided BOTH origins' callback URLs are registered on the
// D2L application. Same reasoning as the YouTube connect route.
export async function GET(request: NextRequest) {
  const redirectUri = `${request.nextUrl.origin}/api/brightspace/oauth/callback`;
  const state = randomBytes(24).toString("hex");
  const authUrl = buildAuthUrl(redirectUri, state);

  // 501 rather than a redirect: with no registered app there is nothing to
  // redirect TO, and sending the user to a broken authorize page would look
  // like an institution outage rather than missing configuration.
  if (!authUrl) {
    return NextResponse.json(
      {
        error: "Brightspace OAuth is not configured",
        requires: ["BRIGHTSPACE_HOST", "BRIGHTSPACE_CLIENT_ID", "BRIGHTSPACE_CLIENT_SECRET"],
      },
      { status: 501 },
    );
  }

  const response = NextResponse.redirect(authUrl);
  // Short-lived and httpOnly — read back and cleared in the callback to
  // confirm this request actually originated the flow (CSRF protection).
  response.cookies.set("bs_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
