/**
 * Live integration and database check — Phase 1, 2 and 8.
 *
 *   npm run integration:check
 *
 * Deliberately separate from operator-live-test: this needs no Gemini key, so
 * a partially-configured environment can still establish what actually works.
 * Everything here is READ-ONLY. Nothing is created, sent, purchased or
 * mutated; no SMS is sent and no OAuth grant is altered.
 *
 * Reports PRESENT / MISSING / INVALID / NOT APPLICABLE per the brief, and
 * never prints a credential value.
 */
// MUST be the first import. ES modules evaluate in import order, so this
// populates process.env before any module below is evaluated — see
// scripts/load-env.ts.
import "./load-env";
import { describeEnvSource } from "./load-env";
import { safeError } from "./safe-error";
import { createAdminClient } from "../lib/supabase/admin";
import { getIntegrationStatuses } from "../lib/integrations/status";
import { fetchRecentWorkouts } from "../lib/integrations/hevy";

const RESET = "\x1b[0m", GREEN = "\x1b[32m", RED = "\x1b[31m", YELLOW = "\x1b[33m", DIM = "\x1b[2m";
const has = (n: string) => Boolean(process.env[n]);

type Verdict = "PRESENT" | "MISSING" | "INVALID" | "NOT APPLICABLE";
const results: { area: string; item: string; verdict: Verdict; detail: string }[] = [];

function record(area: string, item: string, verdict: Verdict, detail = "") {
  results.push({ area, item, verdict, detail });
  const colour = verdict === "PRESENT" ? GREEN : verdict === "MISSING" ? RED : verdict === "INVALID" ? RED : DIM;
  console.log(`  ${colour}${verdict.padEnd(15)}${RESET} ${item.padEnd(34)} ${DIM}${detail}${RESET}`);
}

async function checkSupabase() {
  console.log(`\n${YELLOW}Supabase${RESET}`);
  if (!has("NEXT_PUBLIC_SUPABASE_URL") || !has("SUPABASE_SERVICE_ROLE_KEY")) {
    record("supabase", "credentials", "MISSING", "cannot test connectivity");
    return;
  }
  record("supabase", "credentials", "PRESENT");

  const supabase = createAdminClient();

  // Connectivity + authentication in one: a trivial count against a table
  // that has existed since migration 0002.
  const probe = await supabase.from("tasks").select("*", { count: "exact", head: true });
  if (probe.error) {
    record("supabase", "connectivity / auth", "INVALID", safeError(probe.error.message));
    return;
  }
  record("supabase", "connectivity / auth", "PRESENT", `reachable, tasks table readable (${probe.count ?? 0} rows)`);

  // Migration 0036: the two columns it adds. A missing-column error here is
  // the signal that it has not been applied to THIS database.
  const cadence = await supabase.from("habits").select("cadence, days_of_week").limit(1);
  record("schema", "migration 0036 (routine cadence)", cadence.error ? "MISSING" : "PRESENT",
    cadence.error ? `habits.cadence/days_of_week absent — apply 0036` : "habits.cadence + days_of_week exist");

  // A representative read from each domain, proving the generated types match
  // the real columns and the app's own queries execute.
  const domains: [string, () => PromiseLike<{ error: { message: string } | null }>][] = [
    ["tasks", () => supabase.from("tasks").select("id, title, status, priority, due_date").limit(1)],
    ["goals", () => supabase.from("goals").select("id, title, timeframe").limit(1)],
    ["deals", () => supabase.from("deals").select("id, stage_id, closed_at").limit(1)],
    ["habits", () => supabase.from("habits").select("id, name, is_active").limit(1)],
    ["workouts", () => supabase.from("workouts").select("id, started_at, completed").limit(1)],
    ["transactions", () => supabase.from("transactions").select("id, amount, occurred_at").limit(1)],
    ["memory_entries", () => supabase.from("memory_entries").select("id, title, body, type, pinned").limit(1)],
  ];
  for (const [name, run] of domains) {
    const { error } = await run();
    record("queries", `${name} query`, error ? "INVALID" : "PRESENT", error ? safeError(error.message) : "columns match the generated types");
  }
}

async function checkHevy() {
  console.log(`\n${YELLOW}Hevy${RESET}`);
  if (!has("HEVY_API_KEY")) {
    record("hevy", "HEVY_API_KEY", "MISSING", "configuration_required — manual logging still works");
    return;
  }
  record("hevy", "HEVY_API_KEY", "PRESENT");
  try {
    // Read-only: lists recent workouts. Creates nothing.
    const result = await fetchRecentWorkouts(3);
    if (result.data) {
      record("hevy", "authenticated read", "PRESENT", `${result.data.length} recent workout(s) returned`);
    } else {
      record("hevy", "authenticated read", "INVALID", result.failure ?? result.status.message);
    }
  } catch (error) {
    record("hevy", "authenticated read", "INVALID", safeError(error));
  }
}

function checkSms() {
  console.log(`\n${YELLOW}Twilio / SMS${RESET} ${DIM}(configuration only — no message is sent)${RESET}`);
  const smsVars = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "OWNER_PHONE_NUMBER"];
  const smsAbsent = smsVars.filter((v) => !has(v));
  record("sms", "all four Twilio variables", smsAbsent.length ? "MISSING" : "PRESENT",
    smsAbsent.length ? `webhook no-ops — unset: ${smsAbsent.join(", ")}` : "inbound webhook will process messages");

  console.log(`\n${YELLOW}Google Calendar${RESET}`);
  record("calendar", "Google Calendar integration", "NOT APPLICABLE",
    "this codebase has none; the calendar tool reads JARVIS's own combined schedule");
}

async function main() {
  console.log(`${YELLOW}=== JARVIS integration check (read-only) ===${RESET}`);
  console.log(`${DIM}${describeEnvSource()}${RESET}`);

  await checkSupabase();
  await checkHevy();
  checkSms();

  console.log(`\n${YELLOW}Integration states, as the app and the AI tools see them${RESET}`);
  // Credential-only. The grant-aware variant existed for the two OAuth
  // integrations, both of which are gone; what is left is answered by
  // environment variables alone.
  const statuses = getIntegrationStatuses();
  for (const s of statuses) console.log(`  ${s.state.padEnd(23)} ${s.label.padEnd(12)} ${DIM}${s.message}${RESET}`);

  const bad = results.filter((r) => r.verdict === "INVALID");
  console.log("");
  if (bad.length) {
    console.log(`${RED}${bad.length} check(s) INVALID — a credential exists but the integration could not be used.${RESET}`);
    process.exit(1);
  }
  console.log(`${GREEN}No INVALID results. Anything MISSING is unconfigured, not broken.${RESET}`);
}

main();
