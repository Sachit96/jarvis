import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /api/webhooks/* and /api/mentor/run are called by external services
// (GoHighLevel, a scheduled cron trigger) with no Supabase session — those
// routes authenticate themselves via a shared secret instead.
const AUTH_PATHS = ["/login", "/signup"];

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
  // on every request — required for middleware to trust the session.
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // Local-dev-only: auto-sign-in a fixed account instead of showing /login.
  // Gated on NODE_ENV so this can never activate in a production build even
  // if DEV_AUTH_BYPASS were accidentally set there — and in practice it never
  // will be, since it only lives in .env.local, which Netlify doesn't read.
  // This signs in a REAL Supabase user (not a bypass of RLS), so every RLS
  // policy and query in the app keeps working completely unchanged.
  const devBypassEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_AUTH_BYPASS === "true" &&
    !!process.env.DEV_USER_EMAIL &&
    !!process.env.DEV_USER_PASSWORD;

  if (!user && devBypassEnabled) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: process.env.DEV_USER_EMAIL!,
      password: process.env.DEV_USER_PASSWORD!,
    });
    if (!error) user = data.user;
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
