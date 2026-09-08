import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Step 15, as a test rather than a one-off sweep.
 *
 * An audit that ran once tells you about the day it ran. These are the
 * properties that must keep holding, so they run on every commit.
 *
 * Deliberately source-scanning: each of these is about what the code is
 * ALLOWED to contain, which no amount of runtime testing can establish.
 */

const ROOTS = ["lib", "app", "components", "actions", "hooks", "netlify", "scripts"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts|mjs)$/.test(full)) out.push(full);
  }
  return out;
}

const FILES = ROOTS.flatMap((r) => {
  try { return walk(r); } catch { return []; }
});
const read = (f: string) => readFileSync(f, "utf8");

/**
 * A non-public env var reference — i.e. something that may be a secret.
 * Built fresh per use: a global regex carries lastIndex between calls, which
 * makes repeated .test() calls on the same pattern quietly alternate.
 */
const secretEnvPattern = () => /process\.env\.(?!NEXT_PUBLIC_)[A-Z][A-Z0-9_]+/;

/**
 * A console argument list with its literal TEXT removed, keeping only what is
 * actually interpolated into it.
 *
 * The distinction this exists for: `console.error("Missing GEMINI_API_KEY")`
 * is a helpful diagnostic naming a variable, while
 * `console.error(process.env.GEMINI_API_KEY)` leaks its value. Matching the
 * raw source cannot tell them apart, and three real diagnostics in
 * netlify/functions read `process.env.URL is not set` as prose.
 */
function interpolatedOnly(source: string): string {
  let out = "";
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      // Skip the whole literal; none of its text is evaluated.
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) i += source[i] === "\\" ? 2 : 1;
      continue;
    }
    if (ch === "`") {
      i++;
      let depth = 0;
      while (i < source.length && (depth > 0 || source[i] !== "`")) {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i] === "$" && source[i + 1] === "{") { depth++; i += 2; out += " "; continue; }
        if (depth > 0) {
          if (source[i] === "{") depth++;
          if (source[i] === "}") { depth--; i++; continue; }
          if (depth > 0) out += source[i];
        }
        i++;
      }
      continue;
    }
    out += ch;
  }
  return out;
}

describe("secrets stay on the server", () => {
  test("no client component reads a non-public environment variable", () => {
    const offenders = FILES.filter((f) => {
      const src = read(f);
      if (!/^["']use client["']/m.test(src)) return false;
      return secretEnvPattern().test(src);
    });
    assert.deepEqual(offenders, [], `client components must not read secrets: ${offenders.join(", ")}`);
  });

  test("every bundled module that reads the service-role key is server-only", () => {
    // Scoped to code that can end up in a bundle. scripts/ and netlify/ are
    // standalone Node processes with no client boundary to cross, and naming
    // the variable in a "you forgot to set this" message is not reading it.
    const offenders = FILES.filter((f) => {
      if (!/^(lib|app|components|actions|hooks)[\\/]/.test(f)) return false;
      const src = read(f);
      return /process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(src) && !/["']server-only["']/.test(src);
    });
    assert.deepEqual(offenders, []);
  });

  test("every vendor API key is read only inside a server-only module or a route", () => {
    const KEYS = ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "HEVY_API_KEY", "BRIGHTSPACE_CLIENT_SECRET", "YOUTUBE_CLIENT_SECRET", "TWILIO_AUTH_TOKEN"];
    const offenders: string[] = [];
    for (const f of FILES) {
      const src = read(f);
      // Reading it into a boolean is not holding it; but the file must still
      // be server-side, which for a page or a route it is by construction.
      if (!KEYS.some((k) => src.includes(`process.env.${k}`))) continue;
      const serverOnly = /["']server-only["']/.test(src);
      const serverAction = /^["']use server["']/m.test(src);
      const routeOrPage = /\/(route|page|layout)\.tsx?$/.test(f) || f.startsWith("netlify/") || f.startsWith("scripts/");
      const isClient = /^["']use client["']/m.test(src);
      if (isClient || !(serverOnly || serverAction || routeOrPage)) offenders.push(f);
    }
    assert.deepEqual(offenders, []);
  });

  test("no secret VALUE is written to a log line", () => {
    // The distinction that matters: naming a variable in a diagnostic
    // ("Missing SUPABASE_SERVICE_ROLE_KEY") is fine and useful. Interpolating
    // its value, or a stored OAuth token, is not.
    const offenders: string[] = [];
    for (const f of FILES) {
      for (const m of read(f).matchAll(/console\.(?:log|error|warn|info)\(([^;]*?)\);/gs)) {
        const args = interpolatedOnly(m[1]);
        if (/process\.env\.(?!NEXT_PUBLIC_)[A-Z][A-Z0-9_]+/.test(args)) offenders.push(`${f}: env value`);
        if (/\.(access_token|refresh_token|client_secret)\b/.test(args)) offenders.push(`${f}: token value`);
      }
    }
    assert.deepEqual(offenders, []);
  });
});

describe("the model cannot reach arbitrary execution", () => {
  test("no eval or Function constructor anywhere in application code", () => {
    const offenders = FILES.filter((f) => /\beval\(|new Function\(/.test(read(f)));
    assert.deepEqual(offenders, []);
  });

  test("the tool layer never builds a table name dynamically", () => {
    // Every .from() in a tool must take a string literal, so a model
    // argument can never choose the table it reads or writes.
    const offenders: string[] = [];
    for (const f of FILES.filter((f) => f.startsWith(join("lib", "ai", "tools")))) {
      for (const m of read(f).matchAll(/\.from\(([^)]*)\)/g)) {
        if (!/^\s*["'][a-z_]+["']\s*$/.test(m[1])) offenders.push(`${f}: .from(${m[1]})`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  test("no raw SQL or RPC is reachable from the tool layer", () => {
    const offenders = FILES.filter(
      (f) => f.startsWith(join("lib", "ai")) && /\.rpc\(|execute_sql|\bsql`/.test(read(f)),
    );
    assert.deepEqual(offenders, []);
  });
});

describe("no password path exists for Brightspace", () => {
  test("nothing in the Brightspace integration accepts a credential", () => {
    const files = FILES.filter((f) => f.includes("brightspace"));
    assert.ok(files.length > 0, "expected the Brightspace integration to exist");
    for (const f of files) {
      const src = read(f);
      // Comments documenting the absence of a password path are the point;
      // an actual field or parameter is not.
      const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      assert.doesNotMatch(code, /password/i, `${f} must have no password path`);
    }
  });
});
