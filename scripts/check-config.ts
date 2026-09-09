/**
 * Environment readiness — Phase 8, step 3.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/check-config.ts
 *
 * Distinct from check-env.mjs, which diffs .env.local against Netlify. This
 * one answers a different question: given the environment this process is
 * running in, what can JARVIS actually do right now? Run it locally, or in a
 * deploy shell, to see the same picture Settings shows.
 *
 * Integration rows are read from lib/integrations/status.ts rather than
 * re-derived, so this script cannot drift from what the app and the AI tools
 * believe. Only the non-integration essentials are listed here directly.
 *
 * NEVER prints a value — only whether a name is set. A tool whose output you
 * might paste into an issue must not be able to leak a key.
 */
// MUST be the first import. ES modules evaluate in import order, so this
// populates process.env before any module below is evaluated — see
// scripts/load-env.ts.
import "./load-env";
import { describeEnvSource } from "./load-env";
import { getIntegrationStatuses } from "../lib/integrations/status";

const RESET = "\x1b[0m", GREEN = "\x1b[32m", RED = "\x1b[31m", YELLOW = "\x1b[33m", DIM = "\x1b[2m";

interface Row { name: string; required: boolean; note: string }

const CORE: Row[] = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, note: "Supabase project URL" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, note: "the only key this app uses — there is no per-user session" },
  { name: "SITE_PASSWORD", required: true, note: "HTTP Basic gate; unset means the whole deployment is public" },
  { name: "CRON_SECRET", required: false, note: "required only for the scheduled /api/mentor/run job" },
];

const OPTIONAL: Row[] = [
  { name: "GOOGLE_PLACES_API_KEY", required: false, note: "Lead Research discovery" },
  { name: "PAGESPEED_API_KEY", required: false, note: "Lead Research audit" },
  { name: "GHL_WEBHOOK_SECRET", required: false, note: "GoHighLevel webhook, if used" },
];

const set = (name: string) => Boolean(process.env[name]);

function print(title: string, rows: Row[]) {
  console.log(`\n${YELLOW}${title}${RESET}`);
  for (const r of rows) {
    const ok = set(r.name);
    const status = ok ? `${GREEN}configured${RESET}` : r.required ? `${RED}MISSING${RESET}   ` : `${DIM}missing${RESET}   `;
    console.log(`  ${status}  ${r.name.padEnd(28)} ${DIM}${r.note}${RESET}`);
  }
}

console.log(`\n${DIM}${describeEnvSource()}${RESET}`);
print("Core", CORE);

console.log(`\n${YELLOW}Integrations${RESET} ${DIM}(state as the app and the AI tools see it)${RESET}`);
for (const s of getIntegrationStatuses()) {
  const colour = s.state === "connected" ? GREEN : s.state === "configuration_required" ? RED : DIM;
  console.log(`  ${colour}${s.state.padEnd(22)}${RESET} ${s.label.padEnd(12)} ${DIM}${s.message}${RESET}`);
  if (s.actionHint) console.log(`  ${" ".repeat(22)} ${" ".repeat(12)} ${DIM}→ ${s.actionHint}${RESET}`);
  const absent = (s.requires ?? []).filter((n) => !set(n));
  if (absent.length) console.log(`  ${" ".repeat(22)} ${" ".repeat(12)} ${DIM}unset: ${absent.join(", ")}${RESET}`);
}

print("Optional", OPTIONAL);

const missingRequired = CORE.filter((r) => r.required && !set(r.name));
console.log("");
if (missingRequired.length) {
  console.log(`${RED}${missingRequired.length} required variable(s) unset — the app cannot run correctly.${RESET}`);
  process.exit(1);
}
console.log(`${GREEN}All required variables are set.${RESET}`);
