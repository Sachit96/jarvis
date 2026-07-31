import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getMemoryEntries } from "@/lib/db/queries/memory";
import { user } from "@/lib/user";

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
 * Prepend this to every Gemini system instruction in the app. Degrades to
 * the base persona (no memory block) if memory_entries can't be read —
 * migration not run yet, or a transient query failure — so a memory outage
 * never blocks the Mentor entirely.
 */
export async function buildPersonaPrefix(supabase: Client): Promise<string> {
  const base = [IDENTITY, TONE, HONESTY_RULE, SELF_REFERENCE].join(" ");

  let memoryBlock = "";
  try {
    const entries = await getMemoryEntries(supabase);
    const relevant = entries
      .filter((e) => e.type === "fact" || e.type === "preference" || e.pinned)
      .slice(0, MAX_MEMORY_ENTRIES);

    if (relevant.length > 0) {
      const lines = relevant.map((e) => {
        const body = e.body.length > MAX_BODY_CHARS ? `${e.body.slice(0, MAX_BODY_CHARS)}…` : e.body;
        return `--- [${e.type}] ${e.title} ---\n${body}`;
      });
      memoryBlock = `\n\nWhat you know about ${user.name}, from his own memory store:\n\n${lines.join("\n\n")}`;
    }
  } catch {
    // memory_entries not migrated yet, or a transient query failure.
  }

  return base + memoryBlock;
}
