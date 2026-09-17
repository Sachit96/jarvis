import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getCourses, getScheduleBlocks, getDeadlines, getAssessments } from "@/lib/db/queries/uni";
import { getLifeScheduleBlocks } from "@/lib/db/queries/life-schedule";
import { getGoogleCalendarConnection, getEventLinkMap, type GoogleCalendarSourceType } from "@/lib/db/queries/google-calendar";
import { upsertEvent, deleteEvent, ensureFreshConnection, findEventIdBySourceKey, type EventBody } from "@/lib/google-calendar/client";
import { nextDateForDayOfWeek, toRfc3339Local, toLocalWallClock, buildWeeklyRrule, APP_TIME_ZONE } from "@/lib/google-calendar/datetime";

type Client = SupabaseClient<Database>;

const BLOCK_TYPE_LABEL: Record<string, string> = {
  lecture: "Lecture",
  tutorial: "Tutorial",
  lab: "Lab",
  office_hours: "Office hours",
};

interface TargetEvent {
  sourceType: GoogleCalendarSourceType;
  sourceId: string;
  body: EventBody;
}

/** "source_type:source_id" — the one key shared by the local link table, Google's extendedProperties stamp, and this module's in-memory bookkeeping. */
function sourceKey(sourceType: GoogleCalendarSourceType, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

/**
 * Builds the full set of events this app owns in the JARVIS calendar, from
 * the standing routine, class times, deadlines, and dated assessments.
 *
 * Recurring weekly items (life blocks, class blocks) get ONE Google event
 * each, with a weekly RRULE — not one event per week — so editing a
 * routine block edits one thing in Google Calendar too, same as it does
 * here. Dated items (deadlines, assessment due dates) get single events.
 *
 * Every event is stamped with extendedProperties.private.jarvis_source —
 * see findEventIdBySourceKey in client.ts for why: it's what lets a later
 * sync recognize an event this app already created even if the local link
 * row for it never got written (a partial failure on a previous run).
 */
async function buildTargetEvents(supabase: Client): Promise<TargetEvent[]> {
  const [lifeBlocks, courses, deadlines] = await Promise.all([
    getLifeScheduleBlocks(supabase),
    getCourses(supabase),
    getDeadlines(supabase),
  ]);
  const courseIds = courses.map((c) => c.id);
  const [classBlocks, assessments] = await Promise.all([
    getScheduleBlocks(supabase, courseIds),
    getAssessments(supabase, courseIds),
  ]);
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const targets: TargetEvent[] = [];

  for (const block of lifeBlocks) {
    const anchor = nextDateForDayOfWeek(block.day_of_week);
    targets.push({
      sourceType: "life_schedule_block",
      sourceId: block.id,
      body: {
        summary: block.label,
        description: block.notes ?? undefined,
        start: { dateTime: toRfc3339Local(anchor, block.start_time), timeZone: APP_TIME_ZONE },
        end: { dateTime: toRfc3339Local(anchor, block.end_time), timeZone: APP_TIME_ZONE },
        recurrence: [buildWeeklyRrule(block.day_of_week)],
        extendedProperties: { private: { jarvis_source: sourceKey("life_schedule_block", block.id) } },
      },
    });
  }

  for (const block of classBlocks) {
    const course = courseById.get(block.course_id);
    if (!course) continue; // orphaned block (course deleted) — nothing sensible to sync
    const anchor = nextDateForDayOfWeek(block.day_of_week);
    const termEnd = course.term_end ? new Date(`${course.term_end}T00:00:00`) : null;
    targets.push({
      sourceType: "uni_schedule_block",
      sourceId: block.id,
      body: {
        summary: `${course.code} — ${BLOCK_TYPE_LABEL[block.type] ?? block.type}`,
        location: block.room ?? undefined,
        start: { dateTime: toRfc3339Local(anchor, block.start_time), timeZone: APP_TIME_ZONE },
        end: { dateTime: toRfc3339Local(anchor, block.end_time), timeZone: APP_TIME_ZONE },
        recurrence: [buildWeeklyRrule(block.day_of_week, termEnd)],
        extendedProperties: { private: { jarvis_source: sourceKey("uni_schedule_block", block.id) } },
      },
    });
  }

  for (const deadline of deadlines) {
    const start = new Date(deadline.due_at);
    const end = deadline.end_at ? new Date(deadline.end_at) : new Date(start.getTime() + 60 * 60_000);
    targets.push({
      sourceType: "uni_deadline",
      sourceId: deadline.id,
      body: {
        summary: deadline.title,
        description: deadline.notes ?? undefined,
        start: { dateTime: toLocalWallClock(start, APP_TIME_ZONE), timeZone: APP_TIME_ZONE },
        end: { dateTime: toLocalWallClock(end, APP_TIME_ZONE), timeZone: APP_TIME_ZONE },
        extendedProperties: { private: { jarvis_source: sourceKey("uni_deadline", deadline.id) } },
      },
    });
  }

  for (const assessment of assessments) {
    if (!assessment.due_at) continue; // no date to put on a calendar
    const course = courseById.get(assessment.course_id);
    const start = new Date(assessment.due_at);
    const end = new Date(start.getTime() + 60 * 60_000);
    targets.push({
      sourceType: "uni_assessment",
      sourceId: assessment.id,
      body: {
        summary: course ? `${course.code} — ${assessment.title}` : assessment.title,
        description: assessment.notes ?? undefined,
        start: { dateTime: toLocalWallClock(start, APP_TIME_ZONE), timeZone: APP_TIME_ZONE },
        end: { dateTime: toLocalWallClock(end, APP_TIME_ZONE), timeZone: APP_TIME_ZONE },
        extendedProperties: { private: { jarvis_source: sourceKey("uni_assessment", assessment.id) } },
      },
    });
  }

  return targets;
}

export interface SyncResult {
  pushed: number;
  removed: number;
  failed: number;
}

/**
 * Pushes local state to the JARVIS Google Calendar: creates or updates one
 * event per source row, and deletes any previously-synced event whose
 * source row no longer exists (a deleted task/block/deadline). This is the
 * "push" half of two-way sync — pulling changes made directly in Google
 * back into JARVIS is the next increment (tracked in the calendar_connections
 * row's sync_token column, unused by this function).
 *
 * One row failing (a transient Google API error) does not abort the rest —
 * this can be run again, and already-synced rows are cheap no-op updates.
 */
export async function pushLocalScheduleToGoogle(supabase: Client): Promise<SyncResult> {
  const stored = await getGoogleCalendarConnection(supabase);
  if (!stored) throw new Error("Google Calendar is not connected");
  // Refreshed ONCE up front, not per-item — see ensureFreshConnection's own
  // doc comment (external review, 2026-09-17) for why doing this inside
  // the loop instead was both wasteful (a redundant refresh call per item
  // whenever the token started the run expired) and worse for error
  // clarity (a dead refresh_token would fail N times, once per item,
  // instead of once here with a clear message).
  const connection = await ensureFreshConnection(supabase, stored);

  const [targets, linkMap] = await Promise.all([buildTargetEvents(supabase), getEventLinkMap(supabase)]);

  let pushed = 0;
  let failed = 0;
  const seenKeys = new Set<string>();

  for (const target of targets) {
    const key = sourceKey(target.sourceType, target.sourceId);
    seenKeys.add(key);
    const existingLink = linkMap.get(key);
    try {
      // No local link yet — either genuinely new, or a previous run's
      // Google write succeeded but its link-row write then failed (see
      // findEventIdBySourceKey's doc comment). Check for that orphan
      // before creating, so a partial failure self-heals instead of
      // producing a permanent duplicate on every future sync.
      const existingEventId = existingLink?.google_event_id ?? (await findEventIdBySourceKey(supabase, connection, key));
      const googleEventId = await upsertEvent(supabase, connection, existingEventId, target.body);
      const { error } = await supabase
        .from("google_calendar_event_links")
        .upsert(
          { source_type: target.sourceType, source_id: target.sourceId, google_event_id: googleEventId, last_pushed_at: new Date().toISOString() },
          { onConflict: "source_type,source_id" },
        );
      if (error) throw error;
      pushed++;
    } catch (err) {
      failed++;
      console.error(`[google-calendar sync] failed to push ${key}:`, err instanceof Error ? err.message : err);
    }
  }

  // Links whose source row is gone — the block/deadline/assessment was deleted locally since the last sync.
  let removed = 0;
  for (const [key, link] of linkMap) {
    if (seenKeys.has(key)) continue;
    try {
      await deleteEvent(supabase, connection, link.google_event_id);
      await supabase.from("google_calendar_event_links").delete().eq("id", link.id);
      removed++;
    } catch (err) {
      failed++;
      console.error(`[google-calendar sync] failed to remove ${key}:`, err instanceof Error ? err.message : err);
    }
  }

  await supabase.from("google_calendar_connections").update({ last_synced_at: new Date().toISOString() }).eq("id", true);

  return { pushed, removed, failed };
}
