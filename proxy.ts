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
// EXCEPT the server-to-server routes below, each independently
// authenticated and unreachable by their real caller through this gate:
//
// - /api/sms/webhook, /api/webhooks/ghl — Twilio and GoHighLevel POST
//   directly to these and have no way to attach the site's Basic Auth
//   credentials (found verifying SMS signature validation). Own auth:
//   Twilio's X-Twilio-Signature HMAC, GHL's ?secret= query param.
// - /api/mentor/run, /api/research/runs(/*) — Netlify Scheduled Functions
//   (netlify/functions/*-schedule.mts) call these with
//   `Authorization: Bearer <CRON_SECRET>` and nothing else. Found live
//   (Business Pipeline Cockpit Phase 0): this collides on the SAME header
//   this gate reads for "Basic <password>" — a request can only ever send
//   one Authorization value, so these have been 401-ing at the proxy
//   before the route's own bearer check ever ran a single time since this
//   file was written. That means the recurring Lead Research schedule and
//   the daily/weekly AI Mentor briefs have never actually fired in
//   production — only their manual/dev-mode paths were ever exercised.
//
// /api/hevy and /api/export/json are NOT included here on purpose: their
// own comments frame CRON_SECRET as defense-in-depth ON TOP OF this gate
// (deliberately two factors on the most sensitive routes), which the same
// single-header collision makes structurally impossible as coded — but
// fixing that means picking a real second channel (a distinct header, not
// reusing Authorization), a design decision left to a real work order
// rather than folded into this fix.
//
// Every other route, including the OAuth callback a browser redirects
// back to (which still carries the site's cached Basic Auth), stays
// gated.
const UNGATED_WEBHOOK_PATHS = ["/api/sms/webhook", "/api/webhooks/ghl", "/api/mentor/run"];
const UNGATED_PREFIXES = ["/api/research/runs"];

/**
 * Segment-aware, not a bare startsWith — found walking this carve-out
 * (Cleanup work order, "walk the auth carve-out"): plain
 * `pathname.startsWith(p)` also matches a path that merely shares p's
 * characters as a prefix with no path separator after it, e.g. a
 * hypothetical future `/api/research/runsomethingelse` would match
 * "/api/research/runs" under startsWith even though it isn't really a
 * sub-path. No such route exists today (verified: exactly 3 real route
 * files live under /api/research/runs*, each with its own enforced
 * hasValidBearerToken check — walked all of them, not assumed), so this
 * hasn't bitten anyone yet, but the check itself should be correct
 * regardless of what gets added later.
 */
export function matchesUngatedPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (UNGATED_WEBHOOK_PATHS.includes(pathname) || UNGATED_PREFIXES.some((p) => matchesUngatedPrefix(pathname, p))) {
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
