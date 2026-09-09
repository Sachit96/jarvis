import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { safeError } from "../scripts/safe-error.ts";
import { redactSecrets } from "../lib/redact.ts";

/**
 * The standalone scripts get no framework env loading.
 *
 * next dev and next build read .env.local for the app, so nothing in app/ or
 * lib/ has to think about it. A tsx script sees only what the shell exported,
 * which is why operator:live reported BLOCKED on a machine whose .env.local
 * was perfectly well populated. These lock in the fix.
 */

const QA_SCRIPTS = [
  "scripts/operator-live-test.ts",
  "scripts/integration-check.ts",
  "scripts/check-config.ts",
];

describe("script environment loading", () => {
  test("every QA script imports the loader BEFORE anything else", () => {
    // Order is the whole mechanism: ES modules evaluate in import order, so a
    // new import added above this line would run before process.env is
    // populated. That regression is silent — the script just reports
    // everything as missing again.
    for (const path of QA_SCRIPTS) {
      const imports = readFileSync(path, "utf8")
        .split("\n")
        .filter((l) => /^import\s/.test(l));
      assert.ok(imports.length > 0, `${path} has no imports`);
      assert.match(imports[0], /["']\.\/load-env["']/, `${path}: first import must be ./load-env`);
    }
  });

  test("no QA script pulls in dotenv", () => {
    // @next/env ships with Next and applies Next's own precedence rules;
    // a second loader would be a second set of rules to keep in sync.
    for (const path of [...QA_SCRIPTS, "scripts/load-env.ts"]) {
      assert.doesNotMatch(readFileSync(path, "utf8"), /from ["']dotenv/, `${path} must not use dotenv`);
    }
  });

  test("loadEnvConfig reads .env.local, and the shell still wins", () => {
    // The actual mechanism, against a fixture directory — no real credential
    // is involved, and none is needed to prove the behaviour.
    const dir = mkdtempSync(join(tmpdir(), "jarvis-env-"));
    writeFileSync(join(dir, ".env.local"), "JARVIS_FIXTURE_ONLY=from_file\nJARVIS_FIXTURE_SHELL=from_file\n");

    const before = { ...process.env };
    process.env.JARVIS_FIXTURE_SHELL = "from_shell";
    try {
      // forceReload, because @next/env caches its first load per process.
      loadEnvConfig(dir, undefined, { info: () => {}, error: () => {} }, true);
      assert.equal(process.env.JARVIS_FIXTURE_ONLY, "from_file", ".env.local should populate a new variable");
      assert.equal(
        process.env.JARVIS_FIXTURE_SHELL,
        "from_shell",
        "an exported variable must win over .env.local — Next's documented precedence",
      );
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
      Object.assign(process.env, before);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("script error reporting", () => {
  test("a Supabase-shaped error does not render as [object Object]", () => {
    // Supabase throws plain objects, not Errors, so the usual
    // `e instanceof Error ? e.message : String(e)` printed "[object Object]"
    // for every failing case in the live matrix.
    const rendered = safeError({ message: "relation does not exist", code: "42P01", hint: "check the migration" });
    assert.doesNotMatch(rendered, /\[object Object\]/);
    assert.match(rendered, /relation does not exist/);
    assert.match(rendered, /42P01/);
  });

  test("a fetch failure keeps the cause, which is the useful part", () => {
    const error = new Error("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND db.example.com") });
    assert.match(safeError(error), /ENOTFOUND/);
  });

  test("an exact duplicate field is dropped but a superset is kept", () => {
    const deduped = safeError({ message: "boom", details: "boom" });
    assert.equal(deduped, "boom");
    // `details` usually repeats the message AND adds the cause chain; losing
    // that would throw away the diagnosis.
    assert.match(safeError({ message: "boom", details: "boom — caused by ENOTFOUND" }), /ENOTFOUND/);
  });

  test("a long token in an error message is redacted", () => {
    // Deliberately NOT shaped like any real credential. An earlier version of
    // this test used a realistic "sbp_"-prefixed value and GitHub's push
    // protection blocked the commit — correctly, since a string that
    // pattern-matches a live token type has no business in a repository even
    // when it is invented. What is under test is the length rule, not a
    // vendor prefix.
    const leaky = new Error("auth failed for key NOTAREALSECRETNOTAREALSECRETNOTAREAL");
    const rendered = safeError(leaky);
    assert.doesNotMatch(rendered, /NOTAREALSECRET/);
    assert.match(rendered, /«redacted»/);
  });

  test("a thrown string or null still renders", () => {
    assert.match(safeError("just a string"), /just a string/);
    assert.match(safeError(null), /null/);
  });
});

describe("secret redaction", () => {
  /**
   * Shared by lib/ai/providers/gemini-client (which now surfaces Google's own
   * error message, so that message reaches logs) and the QA scripts. One rule,
   * tested once.
   */
  test("a long token is removed, ordinary prose is not", () => {
    assert.equal(redactSecrets("connection refused for db.example.com"), "connection refused for db.example.com");
    assert.match(redactSecrets("key AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA failed"), /«redacted»/);
  });

  test("redaction does not swallow the diagnosis around it", () => {
    // The point of surfacing an API error is the words; only the token goes.
    const line = redactSecrets("INVALID_ARGUMENT: Unknown name at tools[0] token BBBBBBBBBBBBBBBBBBBBBBBBBBBB");
    assert.match(line, /INVALID_ARGUMENT/);
    assert.match(line, /Unknown name/);
    assert.doesNotMatch(line, /BBBBBBBB/);
  });
});
