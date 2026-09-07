#!/usr/bin/env node
// Diffs .env.local against Netlify's environment variables. Two different
// checks depending on whether Netlify has the variable marked "secret":
//
// - Secret-scoped vars (padlocked in the dashboard): Netlify's API returns
//   a fixed-width placeholder in place of the real value on every read —
//   confirmed live (2026-09-06) by the uniform 20-character "value" this
//   script originally got back for TWILIO_AUTH_TOKEN, GEMINI_API_KEY,
//   GOOGLE_PLACES_API_KEY, and every other secret-scoped var, regardless
//   of what each one actually is. A first version of this script hashed
//   that placeholder and reported permanent false drift on every one of
//   them, which nearly got misread as a real, second env-var drift
//   incident on top of the confirmed CRON_SECRET one — identical length
//   across heterogeneous credentials is the tell that you're reading a
//   mask, not data. For these, this script can only check NAME presence
//   and CONTEXT coverage (is a value set for "production" at all?), never
//   compare content.
// - Non-secret vars: Netlify returns the real value, so a SHA-256
//   fingerprint (never the raw value) is compared against .env.local's.
//
// Requires NETLIFY_AUTH_TOKEN in the environment (see .netlify-token /
// jarvis-tooling-preferences memory) and a linked .netlify/state.json.

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const ENV_LOCAL_PATH = ".env.local";
const NETLIFY_STATE_PATH = ".netlify/state.json";
const REQUIRED_CONTEXT = "production";

function fail(message) {
  console.error(`[check-env] ${message}`);
  process.exit(1);
}

function fingerprint(value) {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
}

function parseEnvLocal(path) {
  if (!existsSync(path)) fail(`${path} not found — run this from the repo root.`);
  const entries = new Map();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    const name = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim();
    if (name) entries.set(name, value);
  }
  return entries;
}

/** Returns null if the variable doesn't exist on Netlify at all. */
async function fetchNetlifyEnvVar(authToken, siteId, key) {
  const res = await fetch(
    `https://api.netlify.com/api/v1/accounts/${siteId}/env/${encodeURIComponent(key)}?site_id=${siteId}`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Netlify API ${res.status} for ${key}`);
  return res.json();
}

async function main() {
  const authToken = process.env.NETLIFY_AUTH_TOKEN;
  if (!authToken) fail("NETLIFY_AUTH_TOKEN is not set — export NETLIFY_AUTH_TOKEN=$(cat .netlify-token) first.");
  if (!existsSync(NETLIFY_STATE_PATH)) fail(`${NETLIFY_STATE_PATH} not found — this repo isn't linked to a Netlify site.`);
  const { siteId } = JSON.parse(readFileSync(NETLIFY_STATE_PATH, "utf8"));
  if (!siteId) fail(`${NETLIFY_STATE_PATH} has no siteId.`);

  const local = parseEnvLocal(ENV_LOCAL_PATH);

  const rows = [];
  let problemCount = 0;

  for (const [name, localValue] of local) {
    let data;
    try {
      data = await fetchNetlifyEnvVar(authToken, siteId, name);
    } catch (err) {
      rows.push({ name, status: "ERROR", detail: err instanceof Error ? err.message : String(err) });
      problemCount++;
      continue;
    }
    if (data === null) {
      rows.push({ name, status: "MISSING_ON_NETLIFY" });
      problemCount++;
      continue;
    }

    const prodEntry = (data.values ?? []).find((v) => v.context === REQUIRED_CONTEXT);

    if (data.is_secret) {
      // Content is unreadable by design — only presence/coverage is checkable.
      if (!prodEntry) {
        rows.push({ name, status: "SECRET_MISSING_FROM_PRODUCTION" });
        problemCount++;
      } else {
        const contexts = (data.values ?? []).map((v) => v.context).join(", ");
        rows.push({ name, status: "SECRET_PRESENT", detail: `contexts: ${contexts}` });
      }
      continue;
    }

    if (!prodEntry) {
      rows.push({ name, status: "MISSING_ON_NETLIFY" });
      problemCount++;
      continue;
    }

    const localFp = fingerprint(localValue);
    const netlifyFp = fingerprint(prodEntry.value);
    if (localFp === netlifyFp) {
      rows.push({ name, status: "MATCH", detail: localFp });
    } else {
      rows.push({ name, status: "MISMATCH", detail: `local=${localFp} netlify=${netlifyFp}` });
      problemCount++;
    }
  }

  const width = Math.max(...rows.map((r) => r.name.length), 4);
  for (const r of rows) {
    const pad = r.name.padEnd(width);
    console.log(`${pad}  ${r.status}${r.detail ? `  (${r.detail})` : ""}`);
  }

  console.log("");
  if (problemCount === 0) {
    console.log(`[check-env] All ${rows.length} variables check out (secret-scoped ones checked for presence only, not content).`);
  } else {
    console.log(`[check-env] ${problemCount} problem(s) found — review before publishing.`);
    process.exit(1);
  }
}

main();
