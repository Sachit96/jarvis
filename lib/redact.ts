/**
 * Removes anything that looks like a credential from text that is about to be
 * logged, printed, or shown to a user.
 *
 * Deliberately blunt: any long unbroken run of token characters goes. The
 * realistic leak is a key or connection string echoed back inside a
 * third-party error message, and the cost of over-redacting a harmless long
 * identifier is far lower than the cost of printing a live key.
 *
 * Pure and dependency-free so both server code (lib/ai/providers) and the
 * standalone scripts can share one rule instead of keeping two in sync.
 */
const LONG_TOKEN = /[A-Za-z0-9_-]{24,}/g;

export function redactSecrets(text: string): string {
  return text.replace(LONG_TOKEN, "«redacted»");
}
