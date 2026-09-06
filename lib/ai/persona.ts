import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getMemoryEntries } from "@/lib/db/queries/memory";
import { user } from "@/lib/user";
import { todayStr } from "@/lib/date";

type Client = SupabaseClient<Database>;

// The one place JARVIS's identity is defined — every Gemini call (mentor
// chat, daily brief, weekly review, nutrition chat) prepends this to its
// own call-specific instructions rather than hardcoding a persona string.

const IDENTITY = `You are JARVIS, ${user.name}'s personal operating system and chief of staff. You have access to his business pipeline, finances, health data, goals, habits, and long-term memory.`;

const TONE = `Direct and concise — no filler, no hedging, no "Great question!" or similar openers. Speak like a competent operator briefing the person you work for, not a customer service bot.`;

const HONESTY_RULE = `Never invent a number. If asked about revenue, pipeline, or health metrics, use only the actual data given in your context for this request — if something isn't there, say it isn't tracked yet rather than guessing or estimating.`;

const SELF_REFERENCE = `You answer to the name "JARVIS" and refer to yourself as JARVIS.`;

const MAX_MEMORY_ENTRIES = 10;
const MAX_BODY_CHARS = 600;

/**
 * The pinned "NOW" memory entry states its sprint's Started/Ends dates as
 * free text ("Days remaining: 42") that's typed once and never
 * recomputed — found live (2026-09-06): the mentor was reporting "42 days
 * remaining" on day 39 of the sprint, because that literal string from
 * 2026-07-29 gets echoed into every prompt verbatim forever. Rather than
 * trusting the stale prose, parse the two dates the doc still needs to
 * state by hand (a real one-time commitment, not something to hardcode in
 * app code) and recompute the clock fresh on every call. The stale
 * "Days remaining" line itself is stripped from what reaches the model —
 * see stripStaleClockLine — so the LLM never sees two disagreeing numbers.
 */
export function computeLiveClockBlock(entryBody: string, today: string): string | null {
  const started = entryBody.match(/\*\*Started:\*\*\s*(\d{4}-\d{2}-\d{2})/)?.[1];
  const ends = entryBody.match(/\*\*Ends:\*\*\s*(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!started || !ends) return null;

  const msPerDay = 86_400_000;
  const startDate = new Date(`${started}T00:00:00`);
  const endDate = new Date(`${ends}T00:00:00`);
  const todayDate = new Date(`${today}T00:00:00`);

  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay);
  const elapsedDays = Math.round((todayDate.getTime() - startDate.getTime()) / msPerDay);
  const daysRemaining = Math.round((endDate.getTime() - todayDate.getTime()) / msPerDay);
  const currentWeek = Math.floor(elapsedDays / 7) + 1;
  const totalWeeks = Math.ceil(totalDays / 7);

  if (daysRemaining < 0) {
    return `LIVE CLOCK (computed just now, overrides any date/day-count stated in memory below): the sprint ENDED ${-daysRemaining} day(s) ago (${ends}). Today is ${today}. Say so plainly — do not report it as still in progress.`;
  }
  return `LIVE CLOCK (computed just now, overrides any date/day-count stated in memory below): Today is ${today}. Week ${currentWeek} of ${totalWeeks}. ${daysRemaining} day(s) remaining until ${ends}.`;
}

/**
 * Strips both hand-typed clock lines that the live-computed block above
 * now supersedes: "Days remaining: NN" and "Sprint: Week X of Y" (found
 * live: the first draft of this fix only stripped the former, leaving the
 * NOW body still asserting "Week 1 of 6" three lines above a LIVE CLOCK
 * saying "Week 6 of 6" — the exact kind of two-disagreeing-numbers problem
 * this fix exists to prevent).
 */
export function stripStaleClockLine(body: string): string {
  return body
    .replace(/^- \*\*Days remaining:\*\*.*$/m, "")
    .replace(/^- \*\*Sprint:\*\*.*$/m, "")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Prepend this to every Gemini system instruction in the app. Degrades to
 * the base persona (no memory block) if memory_entries can't be read —
 * migration not run yet, or a transient query failure — so a memory outage
 * never blocks the Mentor entirely.
 */
export async function buildPersonaPrefix(supabase: Client): Promise<string> {
  const base = [IDENTITY, TONE, HONESTY_RULE, SELF_REFERENCE].join(" ");
  const today = todayStr();

  let memoryBlock = "";
  try {
    const entries = await getMemoryEntries(supabase);
    const relevant = entries
      .filter((e) => e.type === "fact" || e.type === "preference" || e.pinned)
      .slice(0, MAX_MEMORY_ENTRIES);

    if (relevant.length > 0) {
      const lines = relevant.map((e) => {
        let body = e.body.length > MAX_BODY_CHARS ? `${e.body.slice(0, MAX_BODY_CHARS)}…` : e.body;

        // The NOW doc's own header says the mentor must flag staleness
        // beyond 24h — that was never actually enforced in code until now.
        const staleParts: string[] = [];
        if (e.title.trim().toUpperCase() === "NOW") {
          const ageHours = (Date.now() - new Date(e.updated_at).getTime()) / 3_600_000;
          if (ageHours > 24) {
            staleParts.push(
              `STALE: this NOW entry was last updated ${Math.floor(ageHours / 24)} day(s) ago — say so before advising on it.`,
            );
          }
          const clock = computeLiveClockBlock(e.body, today);
          if (clock) staleParts.push(clock);
          body = stripStaleClockLine(body);
        }

        const header = staleParts.length > 0 ? `\n${staleParts.join("\n")}\n` : "";
        return `--- [${e.type}] ${e.title} ---${header}\n${body}`;
      });
      memoryBlock = `\n\nWhat you know about ${user.name}, from his own memory store (today is ${today}):\n\n${lines.join("\n\n")}`;
    }
  } catch {
    // memory_entries not migrated yet, or a transient query failure.
  }

  return base + memoryBlock;
}
