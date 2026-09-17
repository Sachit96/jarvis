import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { refreshAccessToken } from "@/lib/google-calendar/oauth";
import { JARVIS_CALENDAR_SUMMARY } from "@/lib/google-calendar/constants";
import { APP_TIME_ZONE } from "@/lib/google-calendar/datetime";
import type { GoogleCalendarConnection } from "@/lib/db/queries/google-calendar";

type Client = SupabaseClient<Database>;

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Refreshes the stored access token when it's expired or about to be (a
 * 2-minute buffer, since a token valid when checked but expired by the time
 * the API call lands would otherwise 401 for no visible reason). Persists
 * the new access_token/expiry back to the singleton row — refresh_token is
 * untouched, since Google only reissues one on the first exchange.
 *
 * Returns the expiry alongside the token (not just the token) so
 * ensureFreshConnection below can hand callers a connection object whose
 * token_expires_at is actually accurate — returning only the access_token
 * here was the root of a real bug (external review, 2026-09-17): a sync
 * run held one `connection` object for its whole loop, so a refresh 2/3 of
 * the way through never updated the in-memory copy anything after it
 * checked against — every remaining item saw the same expired
 * token_expires_at and re-refreshed independently, once per item.
 */
async function withFreshAccessToken(
  supabase: Client,
  connection: GoogleCalendarConnection,
): Promise<{ accessToken: string; tokenExpiresAt: string }> {
  const expiresInMs = new Date(connection.token_expires_at).getTime() - Date.now();
  if (expiresInMs > 2 * 60_000) {
    return { accessToken: connection.access_token, tokenExpiresAt: connection.token_expires_at };
  }

  const tokens = await refreshAccessToken(connection.refresh_token);
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const { error } = await supabase
    .from("google_calendar_connections")
    .update({ access_token: tokens.access_token, token_expires_at: tokenExpiresAt })
    .eq("id", true);
  if (error) throw error;
  return { accessToken: tokens.access_token, tokenExpiresAt };
}

/**
 * Refreshes once, up front, and returns an up-to-date connection object —
 * call this ONE time before a batch of upsertEvent/deleteEvent calls (see
 * sync.ts) so the batch shares a single refresh instead of each call
 * independently re-checking a connection object that was never updated in
 * place. If the refresh_token itself is dead (Testing-mode's 7-day expiry,
 * say), this throws ONCE here — one clear "reconnect Google Calendar"
 * error for the whole run, instead of that same failure surfacing N times
 * as generic per-item failures further down.
 *
 * upsertEvent/deleteEvent still each call withFreshAccessToken themselves
 * too, as a safety net for a sync run long enough to cross the token's
 * real expiry mid-batch — cheap (a Date comparison, no network) once this
 * has already refreshed, so there's no real cost to keeping both.
 */
export async function ensureFreshConnection(
  supabase: Client,
  connection: GoogleCalendarConnection,
): Promise<GoogleCalendarConnection> {
  const { accessToken, tokenExpiresAt } = await withFreshAccessToken(supabase, connection);
  if (accessToken === connection.access_token) return connection;
  return { ...connection, access_token: accessToken, token_expires_at: tokenExpiresAt };
}

async function calendarFetch(accessToken: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

/**
 * Creates the dedicated "JARVIS" secondary calendar on first connect, or
 * finds it again if a stale connection row somehow points at one that no
 * longer exists (reconnect-after-manual-deletion). Deliberately not the
 * user's primary calendar — keeps every block this app writes inside one
 * calendar the user can hide, colour, or delete independently of their own
 * events, and means a sync bug can be undone by deleting one calendar
 * rather than hunting individual events on their real one.
 */
export async function findOrCreateJarvisCalendar(accessToken: string): Promise<{ id: string; summary: string }> {
  const listRes = await calendarFetch(accessToken, "/users/me/calendarList?minAccessRole=owner");
  if (listRes.ok) {
    const list = await listRes.json();
    const existing = (list.items ?? []).find((c: { summary?: string }) => c.summary === JARVIS_CALENDAR_SUMMARY);
    if (existing) return { id: existing.id, summary: existing.summary };
  }

  const createRes = await calendarFetch(accessToken, "/calendars", {
    method: "POST",
    body: JSON.stringify({ summary: JARVIS_CALENDAR_SUMMARY, timeZone: APP_TIME_ZONE }),
  });
  if (!createRes.ok) {
    throw new Error(`Failed to create the JARVIS calendar: ${createRes.status} ${createRes.statusText}`);
  }
  const created = await createRes.json();
  return { id: created.id, summary: created.summary };
}

export interface EventTime {
  /** "YYYY-MM-DDTHH:MM:SS" (no offset) — paired with timeZone below. */
  dateTime: string;
  timeZone: string;
}

export interface EventBody {
  summary: string;
  description?: string;
  location?: string;
  start: EventTime;
  end: EventTime;
  /** e.g. "RRULE:FREQ=WEEKLY;BYDAY=MO" — array because that's the shape Google's API expects, even for one rule. */
  recurrence?: string[];
  /**
   * Stamps every event this app creates with its source row, as
   * "source_type:source_id" — see findEventIdBySourceKey below, which is
   * what lets a sync run recover from a previous run's partial failure
   * (Google accepted the event, the local link-row write then failed)
   * instead of silently creating a second, duplicate event for the same
   * source on the next run.
   */
  extendedProperties?: { private: { jarvis_source: string } };
}

/**
 * Looks for an event this app already created for `sourceKey`
 * ("source_type:source_id") but has no local link row for — the state a
 * sync run is left in if Google accepted an insert and the follow-up
 * write to google_calendar_event_links then failed (found in review,
 * 2026-09-17: that gap meant the next run's local link lookup would miss
 * it and create a second, duplicate event, with the first permanently
 * orphaned since nothing ever looks for an untracked Google event before
 * creating one). Called only when there's no local link for a source —
 * the common path (an existing link) never pays for this extra request.
 */
export async function findEventIdBySourceKey(
  supabase: Client,
  connection: GoogleCalendarConnection,
  sourceKey: string,
): Promise<string | null> {
  const { accessToken } = await withFreshAccessToken(supabase, connection);
  const params = new URLSearchParams({
    privateExtendedProperty: `jarvis_source=${sourceKey}`,
    maxResults: "1",
    showDeleted: "false",
  });
  const res = await calendarFetch(accessToken, `/calendars/${encodeURIComponent(connection.calendar_id)}/events?${params.toString()}`);
  if (!res.ok) return null; // best-effort reconciliation — a failed lookup just falls back to creating, same as before this fix existed
  const data = await res.json();
  return data.items?.[0]?.id ?? null;
}

/** Creates or updates (PUT, full replace) an event, returning its Google event id. */
export async function upsertEvent(
  supabase: Client,
  connection: GoogleCalendarConnection,
  existingEventId: string | null,
  body: EventBody,
): Promise<string> {
  const { accessToken } = await withFreshAccessToken(supabase, connection);
  const path = existingEventId
    ? `/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(existingEventId)}`
    : `/calendars/${encodeURIComponent(connection.calendar_id)}/events`;

  const res = await calendarFetch(accessToken, path, { method: existingEventId ? "PUT" : "POST", body: JSON.stringify(body) });
  if (res.status === 404 && existingEventId) {
    // The event was deleted on Google's side since we last synced (by the
    // user, directly in Calendar) — recreate it rather than failing the
    // whole sync run, and let the caller update the link row to the new id.
    const createRes = await calendarFetch(accessToken, `/calendars/${encodeURIComponent(connection.calendar_id)}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!createRes.ok) throw new Error(`Google Calendar event create failed after 404 on update: ${createRes.status} ${createRes.statusText}`);
    return (await createRes.json()).id;
  }
  if (!res.ok) {
    throw new Error(`Google Calendar event ${existingEventId ? "update" : "create"} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()).id;
}

/** Deletes an event. A 404/410 (already gone on Google's side) is treated as success. */
export async function deleteEvent(
  supabase: Client,
  connection: GoogleCalendarConnection,
  eventId: string,
): Promise<void> {
  const { accessToken } = await withFreshAccessToken(supabase, connection);
  const res = await calendarFetch(
    accessToken,
    `/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar event delete failed: ${res.status} ${res.statusText}`);
  }
}
