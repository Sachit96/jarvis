import "server-only";

/**
 * What the user is allowed to see when an operator turn fails.
 *
 * Both operator surfaces previously returned `err.message` straight to the
 * browser, and the chat renders that string as an assistant bubble — so a
 * Postgres constraint name, a relation-does-not-exist, or an env var name
 * arrived looking as though JARVIS had said it. That is a bad experience and
 * a small disclosure: error text from Supabase names columns, tables and
 * constraints.
 *
 * So failures are classified into the few kinds a user can actually act on,
 * and everything else becomes one honest sentence. The real error is logged
 * server-side, where debugging belongs.
 *
 * The classification reads the message text, which is unavoidable — the
 * throw sites are third-party (Supabase, fetch) and do not carry codes we
 * control. It is only used to pick a friendlier message; nothing is
 * dispatched on it, so a miss degrades to the generic case rather than
 * mistaking one failure for another.
 */

export interface UserFacingError {
  message: string;
  /** Kept as a distinct signal: Voice speaks a shorter line for a backoff. */
  rateLimited: boolean;
}

const GENERIC = "Something went wrong on my side. Nothing was changed — try that again in a moment.";

export function toUserFacingError(error: unknown, context: string): UserFacingError {
  // Full detail, server-side only. This is the copy that keeps the stack.
  console.error(`[${context}]`, error);

  const raw = error instanceof Error ? error.message : String(error);

  // Daily budget: the user can act on this (wait, or raise the limit), and
  // the wording already comes from our own code rather than a vendor.
  if (/daily budget exhausted/i.test(raw)) {
    return {
      message: "I've used up today's AI quota. It resets at midnight UTC.",
      rateLimited: false,
    };
  }

  if (/\b429\b|rate limit|too many requests/i.test(raw)) {
    return { message: "The AI model is busy right now. Give me a moment and ask again.", rateLimited: true };
  }

  if (/\b503\b|high demand|unavailable/i.test(raw)) {
    return { message: "The AI model is temporarily unavailable. Try again shortly.", rateLimited: true };
  }

  // Names the missing piece without naming the variable — Settings is where
  // that belongs, and it already says exactly which one.
  if (/is not configured|GEMINI_API_KEY/i.test(raw)) {
    return { message: "The AI model isn't set up yet. Check Settings for what's missing.", rateLimited: false };
  }

  return { message: GENERIC, rateLimited: false };
}
