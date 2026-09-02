// Plain constants shared between server code (lib/youtube/oauth.ts,
// upload.ts) and client components (the Settings connection card) — kept
// out of oauth.ts specifically because that file is "server-only" and
// pulling any of it into a "use client" component breaks the build.

/**
 * Refresh-token expiry while the OAuth consent screen is unpublished
 * ("Testing" status), which it is for a single-test-user personal setup
 * like this one: Google expires refresh tokens issued under a
 * Testing-status consent screen after 7 days, regardless of use. There's
 * no webhook for this — the token just silently stops working. The
 * Settings card uses this to warn before that happens.
 */
export const TESTING_MODE_TOKEN_LIFETIME_DAYS = 7;
