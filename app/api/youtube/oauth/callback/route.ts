import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exchangeCodeForTokens } from "@/lib/youtube/oauth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error"); // set by Google if the user declined consent
  const expectedState = request.cookies.get("yt_oauth_state")?.value;

  const settingsUrl = new URL("/settings", request.nextUrl.origin);

  if (error) {
    settingsUrl.searchParams.set("youtube_error", error);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    settingsUrl.searchParams.set("youtube_error", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/youtube/oauth/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      // Happens if the user has connected before and Google decided not to reissue one — prompt=consent on the connect route is specifically there to prevent this, but the check stays here as a hard guard rather than silently storing a connection that can't actually refresh.
      settingsUrl.searchParams.set("youtube_error", "no_refresh_token");
      return NextResponse.redirect(settingsUrl);
    }

    let channelId: string | null = null;
    let channelTitle: string | null = null;
    try {
      const channelRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (channelRes.ok) {
        const channelData = await channelRes.json();
        const channel = channelData?.items?.[0];
        channelId = channel?.id ?? null;
        channelTitle = channel?.snippet?.title ?? null;
      }
    } catch {
      // Cosmetic only (Settings card display) — a failed channel lookup must never fail the connection itself.
    }

    const supabase = createAdminClient();
    const { error: dbError } = await supabase.from("yt_connections").upsert({
      id: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
      channel_id: channelId,
      channel_title: channelTitle,
      connected_at: new Date().toISOString(),
    });
    if (dbError) {
      settingsUrl.searchParams.set("youtube_error", "storage_failed");
      return NextResponse.redirect(settingsUrl);
    }

    settingsUrl.searchParams.set("youtube_connected", "1");
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.delete("yt_oauth_state");
    return response;
  } catch {
    settingsUrl.searchParams.set("youtube_error", "token_exchange_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
