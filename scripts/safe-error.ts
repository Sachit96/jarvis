/**
 * Turns anything throwable into a line worth reading, without leaking a
 * credential into it.
 *
 * Two throw shapes reach these scripts. Node and fetch throw real Errors.
 * Supabase throws plain objects — `{ message, code, details, hint }` — which
 * are NOT instanceof Error, so the obvious
 * `e instanceof Error ? e.message : String(e)` renders them as the famously
 * unhelpful "[object Object]". That is exactly what the live matrix printed
 * for every failing case, which made a real failure impossible to diagnose.
 *
 * Redaction is shared with the server code through lib/redact, so the two
 * cannot drift: a connection string or a key echoed back inside an error
 * message is the realistic leak, and these scripts' output is the sort of
 * thing that gets pasted into an issue.
 */
import { redactSecrets } from "../lib/redact";

export function safeError(error: unknown, maxLength = 200): string {
  const raw = describe(error);
  return redactSecrets(raw).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    // fetch failures hide the useful part in `cause` ("getaddrinfo ENOTFOUND").
    const cause = error.cause;
    const causeText = cause instanceof Error ? ` (${cause.message})` : "";
    return `${error.message}${causeText}`;
  }

  if (error && typeof error === "object") {
    // The Supabase/PostgrestError shape, and anything else carrying a message.
    const e = error as Record<string, unknown>;
    const message = typeof e.message === "string" ? e.message : "";
    const parts = [message];
    for (const key of ["code", "details", "hint"]) {
      const value = e[key];
      if (typeof value !== "string" || !value) continue;
      // Skip only a genuine duplicate. `details` often REPEATS the message and
      // then adds the cause chain ("...Caused by: getaddrinfo ENOTFOUND"),
      // which is the most useful part of the whole line — so a superset is
      // kept and only an exact echo is dropped.
      if (value === message || (message && message.includes(value))) continue;
      parts.push(`${key}=${value}`);
    }
    const joined = parts.filter(Boolean).join(" ");
    if (joined) return joined;
    try {
      return JSON.stringify(error);
    } catch {
      return "an unserialisable object was thrown";
    }
  }

  return String(error);
}
