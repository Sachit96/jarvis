/**
 * Interpreting a spoken yes or no.
 *
 * This gates destructive and outbound actions, so it is deliberately strict.
 * A text confirmation is a button — unambiguous by construction. Speech is
 * not: recognition drops words, the mic catches half a sentence, and the
 * user changes their mind mid-utterance. Guessing wrong here deletes
 * something or sends a message.
 *
 * Three rules follow from that:
 *
 *  1. Match whole words only. Substring matching would read "no" out of
 *     "notes" and "yes" out of "yesterday".
 *  2. An utterance containing BOTH signals is ambiguous, never a yes.
 *     "no wait, yes" and "yes — actually no" must both re-ask.
 *  3. Anything unrecognised is ambiguous, not a no. Silently treating a
 *     misheard phrase as cancellation would be safe for the data but would
 *     teach the user that JARVIS ignores them; re-asking is honest.
 *
 * Only an explicit, unambiguous affirmative returns "confirmed".
 */

export type ConfirmationIntent = "confirmed" | "declined" | "ambiguous";

/**
 * Whole phrases, not stems. "go ahead" has to be matched as a unit because
 * "go" and "ahead" separately mean nothing here.
 */
const AFFIRMATIVE = [
  "yes",
  "yeah",
  "yep",
  "yup",
  "confirm",
  "confirmed",
  "do it",
  "go ahead",
  "send it",
  "approve",
  "approved",
  "affirmative",
  "correct",
  "please do",
];

const NEGATIVE = [
  "no",
  "nope",
  "nah",
  "cancel",
  "cancelled",
  "stop",
  "don't",
  "dont",
  "do not",
  "negative",
  "abort",
  "never mind",
  "nevermind",
  "forget it",
];

/**
 * Lowercases and strips punctuation so "Yes!" and "yes," match, while
 * keeping apostrophes because "don't" depends on one. Collapsing whitespace
 * lets multi-word phrases match regardless of spacing from the recogniser.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whole-phrase containment. The padding means a phrase only matches on word
 * boundaries, so "no" does not match inside "notes" and "do it" does not
 * match inside "undo iteration".
 */
function contains(haystack: string, phrase: string): boolean {
  return ` ${haystack} `.includes(` ${phrase} `);
}

export function interpretConfirmation(transcript: string): ConfirmationIntent {
  const text = normalise(transcript);
  if (!text) return "ambiguous";

  const affirmative = AFFIRMATIVE.some((p) => contains(text, p));
  const negative = NEGATIVE.some((p) => contains(text, p));

  // Both present: the user corrected themselves, or the recogniser merged
  // two utterances. Either way the intent is not clear enough to act on
  // something irreversible.
  if (affirmative && negative) return "ambiguous";
  if (affirmative) return "confirmed";
  if (negative) return "declined";
  return "ambiguous";
}

/** What JARVIS says when it could not tell. Kept here so voice and any future SMS surface word it identically. */
export const REPROMPT = "Sorry — I need a clear yes or no.";
