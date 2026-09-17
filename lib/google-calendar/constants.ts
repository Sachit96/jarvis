// Plain constants shared between server code (oauth.ts, client.ts, sync.ts)
// and client components (the Settings connection card) — kept out of
// oauth.ts specifically because that file is "server-only" and pulling any
// of it into a "use client" component breaks the build. Same split as
// lib/youtube/constants.ts used for the (since-removed) YouTube OAuth card.

/** The dedicated calendar JARVIS creates on first connect. */
export const JARVIS_CALENDAR_SUMMARY = "JARVIS";
