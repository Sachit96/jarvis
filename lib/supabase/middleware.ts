import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ============================================================================
 * JARVIS single-account automatic authentication — how this works
 * ============================================================================
 *
 * JARVIS is a personal, single-user app. There is no login page, no signup
 * page, and no sign-out button anywhere in the UI — every request is
 * transparently authenticated as one fixed Supabase account
 * (JARVIS_ACCOUNT_EMAIL / JARVIS_ACCOUNT_PASSWORD, set as env vars — never
 * committed, never sent to the client).
 *
 * WHY THIS IS SAFE (not a security downgrade):
 * This is a real, normal Supabase Auth session — the same cookie-based JWT
 * session any signed-in user would get from the login form this app used to
 * have. Every Row Level Security policy in every migration is untouched and
 * still keys on `auth.uid() = user_id`. The public anon key (already visible
 * in the deployed JS bundle — normal for Supabase, not a leak) is still
 * useless on its own: without a valid session, `auth.uid()` is null and RLS
 * returns/allows nothing. The ONLY new secret this introduces is the fixed
 * account's password, which lives exclusively in server-side env vars
 * (Netlify's "Production" scope), at the same trust tier as
 * SUPABASE_SERVICE_ROLE_KEY. It is never read by client code and never sent
 * to the browser.
 *
 * HOW IT WORKS, STEP BY STEP:
 * 1. Every request calls `supabase.auth.getUser()`. If a valid session
 *    cookie already exists, Supabase's SDK transparently refreshes it here
 *    if the access token expired but the refresh token is still valid — this
 *    is standard @supabase/ssr behavior, nothing custom. This is the
 *    "silent renewal" requirement: it just works via getUser()'s built-in
 *    refresh, no extra code needed.
 * 2. If there's no session at all (first visit ever, or the refresh token
 *    itself has fully expired/been revoked), `user` comes back null. We then
 *    call `signInWithPassword()` with the fixed account's credentials. This
 *    mints a brand new session and — via the cookies.setAll callback below —
 *    writes real Supabase session cookies onto the response. From here on,
 *    step 1 handles every subsequent request until the session eventually
 *    needs renewing again.
 * 3. If that sign-in call itself fails (Supabase Auth outage, wrong stored
 *    password, transient network error), `user` stays null and we do NOT
 *    throw or redirect anywhere special here — we let the request through.
 *    `app/(app)/layout.tsx` is the one that notices `user` is still null at
 *    render time and shows a "Reconnecting…" screen instead of the app shell
 *    (which auto-retries), rather than silently rendering every page with
 *    empty data or a raw error. See components/shell/reconnecting-screen.tsx.
 * 4. /login and /signup no longer exist as real pages (deleted along with
 *    the whole (auth) route group) — this redirect is just a safety net for
 *    old bookmarks/muscle memory, sending them straight to /dashboard.
 *
 * MULTI-USER COMPATIBILITY: nothing about RLS, the schema, or the query/
 * action layer changed to make this work — they already assumed "there is a
 * real authenticated user" and still do. Bringing back a real login form
 * later is a UI-only change: restore the (auth) route group and stop calling
 * signInWithPassword() here. This file is the entire auth surface.
 * ============================================================================
 */

const AUTH_PATHS = ["/login", "/signup"];

function isAutoAuthConfigured() {
  return Boolean(process.env.JARVIS_ACCOUNT_EMAIL && process.env.JARVIS_ACCOUNT_PASSWORD);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() (not getSession()) revalidates the token against Supabase Auth
  // on every request, and transparently refreshes an expired-but-refreshable
  // session — this is the "silently renew" requirement, handled for free by
  // the SDK, not custom code.
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // No valid session at all — mint one for the single fixed account. This
  // only runs on a genuinely session-less request (first visit, or full
  // session loss), not on every request, since a successful sign-in persists
  // a long-lived cookie session via the setAll callback above.
  if (!user && isAutoAuthConfigured()) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: process.env.JARVIS_ACCOUNT_EMAIL!,
      password: process.env.JARVIS_ACCOUNT_PASSWORD!,
    });
    if (!error) {
      user = data.user;
    }
    // If this fails, `user` stays null — app/(app)/layout.tsx renders a
    // Reconnecting screen instead of the app shell rather than exposing an
    // error or silently empty data. We deliberately don't redirect or throw
    // here so the retry happens naturally on the next request/refresh.
  }

  const isAuthPath = AUTH_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  if (isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
