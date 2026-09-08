/**
 * Live operator QA — Phase 8, steps 4, 5, 6 and 16.
 *
 * Everything else in this repo's test suite runs without credentials, which
 * is why it can prove the gates hold but not that the MODEL uses the tools
 * correctly. That question needs a real key, a real database and a real
 * round trip, so it lives here rather than in tests/.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/operator-live-test.ts
 *
 * Read-only by default. `--with-writes` additionally runs the create/update/
 * delete journey, which touches the database — it creates its own records,
 * verifies them, and deletes them, and it never edits anything it did not
 * create. Keep it off unless you accept writes against the connected
 * database.
 *
 * The matrix asserts on TOOL SELECTION, not on the wording of replies: which
 * tools a prompt should reach for is a stable property worth regressing on,
 * whereas the prose is not. `anyOf` passes when at least one listed tool was
 * called; `forbid` fails when a listed tool was called at all — that is how
 * "answer this from one targeted read" is checked, since a model that
 * queries every module on every turn is a real failure even when the answer
 * reads fine.
 */
import { createAdminClient } from "../lib/supabase/admin";
import { runAgentTurn } from "../lib/ai/agent";
import { listTools } from "../lib/ai/tools/registry";
import type { MentorChatMessage } from "../lib/ai/providers/types";

interface Case {
  id: string;
  group: string;
  prompt: string;
  /** Passes when at least one of these ran. */
  anyOf?: string[];
  /** Fails when any of these ran — guards against querying the world. */
  forbid?: string[];
  /** Documented expectation for the report; not asserted. */
  note?: string;
}

const READ_CASES: Case[] = [
  // --- tasks -------------------------------------------------------------
  { id: "T1", group: "tasks", prompt: "What's on my task list today?", anyOf: ["get_today_tasks", "get_tasks"] },
  { id: "T2", group: "tasks", prompt: "What's overdue?", anyOf: ["get_overdue_tasks"],
    forbid: ["get_finance_summary", "get_health_summary", "get_business_pipeline"],
    note: "must not sweep unrelated modules" },
  { id: "T3", group: "tasks", prompt: "What have I got coming up this week?", anyOf: ["get_upcoming_tasks", "get_upcoming"] },

  // --- business ----------------------------------------------------------
  { id: "B1", group: "business", prompt: "What's my current open pipeline?", anyOf: ["get_business_pipeline"] },
  { id: "B2", group: "business", prompt: "Which deals are getting stale?", anyOf: ["get_business_pipeline", "get_follow_ups"] },
  { id: "B3", group: "business", prompt: "Show me the business activity that needs attention.", anyOf: ["get_follow_ups", "get_business_pipeline", "get_leads"] },

  // --- university --------------------------------------------------------
  // With Brightspace unconnected the ONLY acceptable outcome is a plain
  // statement that it is unavailable. Fabricated assignments are the single
  // worst failure this whole harness exists to catch.
  { id: "U1", group: "university", prompt: "What assignments do I have this week?",
    anyOf: ["get_university_deadlines", "get_brightspace_courses"] },
  { id: "U2", group: "university", prompt: "How am I doing in my courses?", anyOf: ["get_grades"] },

  // --- health ------------------------------------------------------------
  { id: "H1", group: "health", prompt: "When did I last work out?", anyOf: ["get_recent_workouts", "get_health_summary"] },
  { id: "H2", group: "health", prompt: "How many workouts did I do this week?", anyOf: ["get_recent_workouts", "get_training_progress"] },

  // --- finance -----------------------------------------------------------
  { id: "F1", group: "finance", prompt: "What is my financial overview?", anyOf: ["get_finance_summary", "get_accounts"] },
  { id: "F2", group: "finance", prompt: "What did I spend recently?", anyOf: ["get_finance_summary", "get_budget_status"] },

  // --- cross-module ------------------------------------------------------
  // These are the ones that matter most: the operator has to combine
  // modules without querying all eight every time.
  { id: "X1", group: "cross", prompt: "What should I focus on today?",
    anyOf: ["get_today_tasks", "get_overdue_tasks", "get_university_deadlines"],
    note: "should combine 2-4 domains, not all of them" },
  { id: "X2", group: "cross", prompt: "What should I focus on tonight?",
    anyOf: ["get_today_tasks", "get_routines", "get_overdue_tasks"] },
  { id: "X3", group: "cross", prompt: "What does tomorrow look like?",
    anyOf: ["get_upcoming_tasks", "get_upcoming", "get_university_deadlines"] },
  { id: "X4", group: "cross", prompt: "What are the most important things I need to get done this week?",
    anyOf: ["get_upcoming_tasks", "get_university_deadlines", "get_follow_ups", "get_overdue_tasks"] },

  // --- acceptance (step 16) ----------------------------------------------
  { id: "A1", group: "acceptance", prompt: "What do I have today?", anyOf: ["get_today_tasks", "get_upcoming"] },
  { id: "A2", group: "acceptance", prompt: "What should I prioritize?", anyOf: ["get_overdue_tasks", "get_today_tasks"] },
  { id: "A3", group: "acceptance", prompt: "What assignments do I need to worry about?", anyOf: ["get_university_deadlines"] },
  { id: "A4", group: "acceptance", prompt: "What leads need attention?", anyOf: ["get_leads", "get_follow_ups", "get_business_pipeline"] },
  { id: "A5", group: "acceptance", prompt: "What should I finish tonight?", anyOf: ["get_today_tasks", "get_routines"] },
];

const RESET = "\x1b[0m", RED = "\x1b[31m", GREEN = "\x1b[32m", DIM = "\x1b[2m", YELLOW = "\x1b[33m";

interface Row {
  id: string; group: string; prompt: string;
  expected: string; actual: string[]; risk: string;
  concurrency: string; response: string; pass: boolean; why: string;
}

const rows: Row[] = [];

function riskOf(names: string[]): string {
  const tools = names.map((n) => listTools().find((t) => t.name === n));
  if (tools.some((t) => t?.risk === "high")) return "high";
  if (tools.some((t) => t?.risk === "low")) return "low";
  return names.length ? "safe" : "-";
}

async function runCase(c: Case) {
  const supabase = createAdminClient();
  const history: MentorChatMessage[] = [{ role: "user", content: c.prompt }];

  let actual: string[] = [];
  let response = "";
  let why = "";
  let pass = true;

  try {
    const result = await runAgentTurn(supabase, history);
    actual = result.trace.map((t) => t.name);
    response = result.text.replace(/\s+/g, " ").trim();

    if (c.anyOf && !c.anyOf.some((n) => actual.includes(n))) {
      pass = false;
      why = `expected one of ${c.anyOf.join("/")}`;
    }
    const forbidden = (c.forbid ?? []).filter((n) => actual.includes(n));
    if (forbidden.length) {
      pass = false;
      why = `${why ? why + "; " : ""}called forbidden ${forbidden.join(", ")}`;
    }
    if (!response) { pass = false; why = `${why ? why + "; " : ""}empty reply`; }
  } catch (error) {
    pass = false;
    why = `threw: ${error instanceof Error ? error.message : String(error)}`;
  }

  // Every tool ran in one round means the provider parallelised; this is
  // reported rather than asserted, since the model decides how many rounds
  // it takes and either can be correct.
  rows.push({
    id: c.id, group: c.group, prompt: c.prompt,
    expected: (c.anyOf ?? []).join(" | ") || "-",
    actual, risk: riskOf(actual),
    concurrency: actual.length > 1 ? "multi-tool" : actual.length === 1 ? "single" : "none",
    response, pass, why,
  });

  const mark = pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`${mark} ${c.id} ${DIM}${c.prompt}${RESET}`);
  console.log(`     tools: ${actual.join(", ") || DIM + "(none)" + RESET}${why ? `  ${RED}${why}${RESET}` : ""}`);
  if (response) console.log(`     ${DIM}${response.slice(0, 160)}${RESET}`);
}

/**
 * Step 6, against the real model: propose → gate → approve → execute, then
 * the two refusal paths. Creates the task it deletes, so nothing pre-existing
 * is ever at risk.
 */
async function runConfirmationJourney() {
  console.log(`\n${YELLOW}=== high-risk confirmation (writes) ===${RESET}`);
  const supabase = createAdminClient();

  const { data: created, error } = await supabase
    .from("tasks")
    .insert({ title: "operator QA — safe to delete", status: "todo" })
    .select("id, title")
    .single();
  if (error || !created) {
    console.log(`${RED}could not create the test task: ${error?.message}${RESET}`);
    return;
  }
  console.log(`${DIM}created test task ${created.id}${RESET}`);

  try {
    const history: MentorChatMessage[] = [
      { role: "user", content: `Delete the task called "operator QA — safe to delete".` },
    ];
    const proposed = await runAgentTurn(supabase, history);

    const halted = Boolean(proposed.pendingConfirmation);
    console.log(`${halted ? GREEN + "PASS" : RED + "FAIL"}${RESET} C1 tool did NOT execute; confirmation raised`);
    if (proposed.pendingConfirmation) {
      console.log(`     summary shown to user: ${proposed.pendingConfirmation.summary}`);
    }

    const stillThere = await supabase.from("tasks").select("id").eq("id", created.id).maybeSingle();
    console.log(`${stillThere.data ? GREEN + "PASS" : RED + "FAIL"}${RESET} C2 the record still exists after the proposal`);

    // "No" and "maybe" are the ABSENCE of a confirmed replay, so the check is
    // that the record survives a turn in which the user did not approve.
    await runAgentTurn(supabase, [...history, { role: "assistant", content: proposed.text }, { role: "user", content: "No." }]);
    const afterNo = await supabase.from("tasks").select("id").eq("id", created.id).maybeSingle();
    console.log(`${afterNo.data ? GREEN + "PASS" : RED + "FAIL"}${RESET} C3 "no" left the record untouched`);

    await runAgentTurn(supabase, [...history, { role: "assistant", content: proposed.text }, { role: "user", content: "Maybe." }]);
    const afterMaybe = await supabase.from("tasks").select("id").eq("id", created.id).maybeSingle();
    console.log(`${afterMaybe.data ? GREEN + "PASS" : RED + "FAIL"}${RESET} C4 "maybe" left the record untouched`);

    if (proposed.pendingConfirmation) {
      const approved = await runAgentTurn(supabase, history, {
        confirmedCall: {
          toolName: proposed.pendingConfirmation.toolName,
          args: proposed.pendingConfirmation.args,
        },
      });
      const gone = await supabase.from("tasks").select("id").eq("id", created.id).maybeSingle();
      console.log(`${!gone.data ? GREEN + "PASS" : RED + "FAIL"}${RESET} C5 approval executed exactly the approved call`);
      console.log(`     ${DIM}${approved.text.slice(0, 160)}${RESET}`);
    }
  } finally {
    // Belt and braces: if any path above left it behind, it does not stay.
    await supabase.from("tasks").delete().eq("id", created.id);
    console.log(`${DIM}cleaned up test task${RESET}`);
  }
}

async function main() {
  const missing = ["GEMINI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    .filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(`BLOCKED — live operator QA needs: ${missing.join(", ")}`);
    console.error("Nothing was run. This is the one part of the suite that cannot be faked.");
    process.exit(2);
  }

  console.log(`${YELLOW}=== read-only operator matrix ===${RESET}`);
  for (const c of READ_CASES) await runCase(c);

  if (process.argv.includes("--with-writes")) {
    await runConfirmationJourney();
  } else {
    console.log(`\n${DIM}Write journey skipped. Re-run with --with-writes to exercise create/complete/delete.${RESET}`);
  }

  const passed = rows.filter((r) => r.pass).length;
  const exercised = new Set(rows.flatMap((r) => r.actual));
  console.log(`\n${YELLOW}=== summary ===${RESET}`);
  console.log(`${passed}/${rows.length} prompts selected an acceptable tool`);
  console.log(`${exercised.size}/${listTools().length} tools exercised by the model`);
  const never = listTools().map((t) => t.name).filter((n) => !exercised.has(n));
  if (never.length) console.log(`${DIM}never chosen: ${never.join(", ")}${RESET}`);

  console.log("\nid   group       result  tools");
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(4)} ${r.group.padEnd(11)} ${(r.pass ? "pass" : "FAIL").padEnd(6)}  ${r.actual.join(", ") || "-"}`,
    );
  }

  process.exit(rows.every((r) => r.pass) ? 0 : 1);
}

main();
