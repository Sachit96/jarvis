/**
 * Shared budget for injecting note content into a Gemini prompt — capped
 * at ~4000 characters total (roughly 1000 tokens), deliberately
 * conservative given Gemma's real, hidden thinking-token tax already eats
 * into the 16K TPM ceiling before a single visible token is generated
 * (verified live earlier this session: 74-367 thinking tokens on trivial
 * prompts). This is a NEW, separate budget from two things that already
 * exist and aren't touched here: lib/ai/persona.ts's MAX_BODY_CHARS (600
 * chars/entry, ~10 entries, for the always-on persona prefix) and WO3's
 * material Q&A (~12,000 chars, a deliberately larger budget for a
 * single-purpose Q&A call that isn't stacked on top of everything else in
 * the prompt). Use this one for any NEW call site injecting
 * wikilink-connected note content (e.g. "here's what's linked to this").
 */
export const NOTE_CONTEXT_CHAR_BUDGET = 4000;

export interface ContextNote {
  title: string;
  body: string;
}

export interface NoteContextResult {
  /** Ready to drop into a prompt. */
  text: string;
  /** Titles of notes that actually made it in, in order — tell the user/model which ones were used if some had to be left out, same convention as WO3's material Q&A. */
  usedTitles: string[];
  /** True if the budget ran out before every note was included. */
  truncated: boolean;
}

/** Packs notes into the budget most-important-first (the order given), stopping (not partially including) once the next note wouldn't fit — a half-truncated note reads as more confusing than a note left out entirely. */
export function buildNoteContext(notes: ContextNote[], maxChars = NOTE_CONTEXT_CHAR_BUDGET): NoteContextResult {
  const blocks: string[] = [];
  const usedTitles: string[] = [];
  let remaining = maxChars;
  let truncated = false;

  for (const note of notes) {
    const block = `--- ${note.title} ---\n${note.body}`;
    if (block.length > remaining) {
      truncated = true;
      continue; // keep checking later notes — a short one might still fit even if this one didn't
    }
    blocks.push(block);
    usedTitles.push(note.title);
    remaining -= block.length;
  }

  return { text: blocks.join("\n\n"), usedTitles, truncated };
}
