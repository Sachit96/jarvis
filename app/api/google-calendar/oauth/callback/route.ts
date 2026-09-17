import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-calendar/oauth";
import { findOrCreateJarvisCalendar } from "@/lib/google-calendar/client";
import { createAdminClient } from "@/lib/supabase/admin";

// This route is NOT in proxy.ts's ungated-webhook carve-out on purpose —
// see proxy.ts's own comment: the browser doing this redirect still has
// the site's Basic Auth credentials cached from the page that started the
// flow, so the gate passes it through same as any other page request.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error"); // set by Google if the user declined consent
  const expectedState = request.cookies.get("gcal_oauth_state")?.value;

  const settingsUrl = new URL("/settings", request.nextUrl.origin);

  if (error) {
    settingsUrl.searchParams.set("gcal_error", error);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    settingsUrl.searchParams.set("gcal_error", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/google-calendar/oauth/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      // Happens if the user has connected before and Google decided not to reissue one — prompt=consent on the connect route is specifically there to prevent this, but the check stays here as a hard guard rather than silently storing a connection that can't actually refresh.
      settingsUrl.searchParams.set("gcal_error", "no_refresh_token");
      return NextResponse.redirect(settingsUrl);
    }

    let calendar: { id: string; summary: string };
    try {
      calendar = await findOrCreateJarvisCalendar(tokens.access_token);
    } catch {
      settingsUrl.searchParams.set("gcal_error", "calendar_setup_failed");
      return NextResponse.redirect(settingsUrl);
    }

    const supabase = createAdminClient();
    const { error: dbError } = await supabase.from("google_calendar_connections").upsert({
      id: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
      calendar_id: calendar.id,
      calendar_summary: calendar.summary,
      connected_at: new Date().toISOString(),
      // A reconnect keeps the previous sync_token/last_synced_at only if we
      // don't clear them — but a genuinely new grant should start clean,
      // since the old sync_token belongs to a connection that may have
      // pointed at a different calendar entirely.
      sync_token: null,
    });
    if (dbError) {
      settingsUrl.searchParams.set("gcal_error", "storage_failed");
      return NextResponse.redirect(settingsUrl);
    }

    settingsUrl.searchParams.set("gcal_connected", "1");
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.delete("gcal_oauth_state");
    return response;
  } catch {
    settingsUrl.searchParams.set("gcal_error", "token_exchange_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
