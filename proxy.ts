import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Free fallback for whatever Netlify's own password-protection needs (a
// plan tier that may not include it). This app has no user auth at all
// (migration 0012_remove_auth) and holds real finance/health/memory data,
// so *something* has to gate the whole deployed site. Gates every request,
// including static assets — safe because browsers resend the Authorization
// header for every request to the same origin once a user has entered it
// once, not just the first one.
//
// No matcher on purpose: this must run on every route including
// `_next/static`/`_next/image`, which a typical negative-matcher exclusion
// list is written to skip.
//
// EXCEPT the two genuine server-to-server inbound webhooks below — found
// live (Business Pipeline Cockpit session, verifying SMS signature
// validation): Twilio and GoHighLevel POST directly to these URLs and have
// no way to attach the site's Basic Auth credentials, so this gate was
// unconditionally 401-ing every real webhook delivery before it ever
// reached the route handler's OWN authentication (Twilio's X-Twilio-
// Signature HMAC, GHL's ?secret= query param — see each route's comment).
// Both have been unreachable from the real services since this file was
// written. Every other route, including the OAuth callback a browser
// redirects back to (which still carries the site's cached Basic Auth),
// stays gated.
const UNGATED_WEBHOOK_PATHS = ["/api/sms/webhook", "/api/webhooks/ghl"];

export function proxy(request: NextRequest) {
  if (UNGATED_WEBHOOK_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const password = process.env.SITE_PASSWORD;
  // Unset = not gated. Matches this app's convention elsewhere (Hevy, GHL,
  // Gemini all degrade to "not configured" rather than hard-failing) — but
  // unlike those, an unset SITE_PASSWORD means a fully public site, so it's
  // worth being loud about that instead of silently doing nothing.
  if (!password) {
    console.warn("[proxy] SITE_PASSWORD is not set — the site is running with no access control.");
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice("Basic ".length), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    const suppliedPassword = separatorIndex === -1 ? decoded : decoded.slice(separatorIndex + 1);

    // Constant-time comparison — timingSafeEqual throws on length mismatch,
    // which would otherwise leak the correct password's length via timing.
    const suppliedBuffer = Buffer.from(suppliedPassword);
    const expectedBuffer = Buffer.from(password);
    const matches =
      suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);

    if (matches) return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="JARVIS", charset="UTF-8"' },
  });
}
