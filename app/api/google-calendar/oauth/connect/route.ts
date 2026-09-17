import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { buildAuthUrl } from "@/lib/google-calendar/oauth";

// Starts the OAuth flow — the "Connect Google Calendar" Settings card links
// here. redirect_uri is derived from the incoming request's own origin, not
// a hardcoded env var, so this works identically on localhost and
// production as long as BOTH origins' /api/google-calendar/oauth/callback
// are registered as Authorized redirect URIs in Google Cloud Console.
export async function GET(request: NextRequest) {
  if (!process.env.GOOGLE_CALENDAR_CLIENT_ID) {
    return NextResponse.json({ error: "GOOGLE_CALENDAR_CLIENT_ID is not configured" }, { status: 501 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/google-calendar/oauth/callback`;
  const state = randomBytes(24).toString("hex");

  const response = NextResponse.redirect(buildAuthUrl(redirectUri, state));
  // Short-lived, httpOnly — read back and cleared in the callback to confirm this request actually originated the flow (CSRF protection).
  response.cookies.set("gcal_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}
