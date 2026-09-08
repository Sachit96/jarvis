import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exchangeCodeForTokens } from "@/lib/integrations/brightspace/oauth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error"); // set if the user declined consent
  const expectedState = request.cookies.get("bs_oauth_state")?.value;

  const settingsUrl = new URL("/settings", request.nextUrl.origin);

  if (error) {
    settingsUrl.searchParams.set("brightspace_error", error);
    return NextResponse.redirect(settingsUrl);
  }
  // A missing or mismatched state means this callback did not come from a
  // flow this app started — the CSRF case. Rejected before the code is
  // exchanged, so a forged callback never reaches the token endpoint.
  if (!code || !state || !expectedState || state !== expectedState) {
    settingsUrl.searchParams.set("brightspace_error", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/brightspace/oauth/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      // Without one the connection silently dies at the first expiry, so
      // this is a hard guard rather than a stored-but-broken connection.
      settingsUrl.searchParams.set("brightspace_error", "no_refresh_token");
      return NextResponse.redirect(settingsUrl);
    }

    const host = process.env.BRIGHTSPACE_HOST ?? "";
    let displayName: string | null = null;
    try {
      // Version-pinned: D2L's whoami lives under a dated API version, and
      // 1.31 is the long-stable one. A failure here is cosmetic only.
      const who = await fetch(`${host}/d2l/api/lp/1.31/users/whoami`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (who.ok) {
        const body = await who.json();
        displayName = [body?.FirstName, body?.LastName].filter(Boolean).join(" ") || body?.UniqueName || null;
      }
    } catch {
      // Cosmetic only (Settings card display) — a failed lookup must never
      // fail the connection itself.
    }

    const supabase = createAdminClient();
    const { error: dbError } = await supabase.from("brightspace_connections").upsert({
      id: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
      host,
      display_name: displayName,
      connected_at: new Date().toISOString(),
    });
    if (dbError) {
      settingsUrl.searchParams.set("brightspace_error", "storage_failed");
      return NextResponse.redirect(settingsUrl);
    }

    settingsUrl.searchParams.set("brightspace_connected", "1");
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.delete("bs_oauth_state");
    return response;
  } catch {
    // The thrown message can carry the truncated provider body; it is
    // logged server-side by the throw itself and deliberately not put into
    // a redirect parameter where it would land in browser history.
    settingsUrl.searchParams.set("brightspace_error", "token_exchange_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
