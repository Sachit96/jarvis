import { loadEnvConfig } from "@next/env";

/**
 * Loads .env.local for the standalone scripts, the way Next itself does.
 *
 * `next dev` and `next build` read .env.local automatically, so nothing in
 * app/ or lib/ ever has to think about it. A script run through tsx gets no
 * such treatment: it sees only what the shell exported. That is why
 * operator:live reported BLOCKED on a machine whose .env.local was perfectly
 * well populated — the variables existed, but not in that process.
 *
 * This is the pattern the Next docs prescribe for exactly this case (see
 * "Loading Environment Variables with @next/env"): a side-effect module that
 * callers import FIRST, before anything that reads process.env.
 *
 * Two properties worth knowing, both from @next/env's own implementation:
 *
 *  - A variable already present in process.env WINS over the file. Exporting
 *    something in your shell still overrides .env.local, which is Next's
 *    documented precedence and means this cannot quietly replace a credential
 *    you set deliberately.
 *  - When NODE_ENV is "test", .env.local is deliberately NOT read, so that
 *    tests produce the same result for everyone. That is correct for the test
 *    suite and surprising for a QA script, so describeEnvSource() below says
 *    so out loud rather than leaving you to wonder.
 *
 * `dev` is intentionally left unset, giving production-mode resolution. These
 * scripts talk to the real database, and development-only overrides are the
 * last thing that should silently apply to them. .env.local is read either
 * way; only .env.development* / .env.production* differ.
 */

// Quiet: the default logger prints an "Environments:" line to stdout, which
// is noise in the middle of a test matrix. The file list is reported through
// describeEnvSource() instead, where the caller decides when to show it.
const quiet = { info: () => {}, error: console.error };

const { loadedEnvFiles } = loadEnvConfig(process.cwd(), undefined, quiet);

/** Names of the env files that were actually read. Never their contents. */
export const envFilesLoaded: string[] = loadedEnvFiles.map((f) => f.path);

/**
 * One line explaining where configuration came from — or why it did not.
 * Names files and variables only, never a value.
 */
export function describeEnvSource(): string {
  if (process.env.NODE_ENV === "test") {
    return "NODE_ENV=test, so .env.local was deliberately skipped by @next/env. Unset NODE_ENV to use it.";
  }
  if (envFilesLoaded.length === 0) {
    return "No .env file found in the project root; using only what the shell exported.";
  }
  return `Loaded ${envFilesLoaded.join(", ")} (shell variables still take precedence).`;
}
