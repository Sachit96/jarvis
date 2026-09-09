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
// MUST be the first import. ES modules evaluate in import order, so this
// populates process.env before any module below is evaluated — see
// scripts/load-env.ts.
import "./load-env";
import { describeEnvSource } from "./load-env";
import { safeError } from "./safe-error";
import { writeFileSync } from "node:fs";
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
  /**
   * Ceiling on how many tools the turn may call. A model that queries every
   * module on every request fails, however good the answer sounds.
   */
  maxTools?: number;
  /** Documented expectation for the report; not asserted. */
  note?: string;
}

const READ_CASES: Case[] = [
  // --- tasks -------------------------------------------------------------
  { id: "T1", group: "tasks", prompt: "What are my tasks today?", anyOf: ["get_today_tasks", "get_tasks"],
    forbid: ["get_finance_summary", "get_health_summary", "get_business_pipeline", "get_grades"] },
  { id: "T2", group: "tasks", prompt: "What tasks are overdue?", anyOf: ["get_overdue_tasks"],
    forbid: ["get_finance_summary", "get_health_summary", "get_business_pipeline"] },
  { id: "T3", group: "tasks", prompt: "What should I work on next?", anyOf: ["get_today_tasks", "get_overdue_tasks", "get_upcoming_tasks"] },
  { id: "T4", group: "tasks", prompt: "What have I got coming up this week?", anyOf: ["get_upcoming_tasks", "get_upcoming"] },

  // --- goals -------------------------------------------------------------
  { id: "G1", group: "goals", prompt: "What are my current goals?", anyOf: ["get_goals"],
    forbid: ["get_finance_summary", "get_health_summary", "get_business_pipeline"] },
  { id: "G2", group: "goals", prompt: "How am I progressing toward my goals?", anyOf: ["get_goals"] },

  // --- business ----------------------------------------------------------
  { id: "B1", group: "business", prompt: "What's my current pipeline?", anyOf: ["get_business_pipeline"],
    forbid: ["get_health_summary", "get_grades", "get_body_metrics"] },
  { id: "B2", group: "business", prompt: "Show me my open deals.", anyOf: ["get_business_pipeline"] },
  { id: "B3", group: "business", prompt: "Which deals are getting stale?", anyOf: ["get_business_pipeline", "get_follow_ups"] },
  { id: "B4", group: "business", prompt: "What should I focus on in my pipeline?", anyOf: ["get_business_pipeline", "get_follow_ups", "get_leads"] },

  // --- university --------------------------------------------------------
  // With Brightspace unconnected the ONLY acceptable outcome is a plain
  // statement that it is unavailable. Fabricated assignments are the single
  // worst failure this whole harness exists to catch — checked by hand
  // against the FINAL RESPONSE column, which is why it is printed in full.
  { id: "U1", group: "university", prompt: "What assignments are coming up?",
    anyOf: ["get_university_deadlines", "get_brightspace_courses"] },
  { id: "U2", group: "university", prompt: "How am I doing academically?", anyOf: ["get_grades"] },
  { id: "U3", group: "university", prompt: "What should I study today?",
    anyOf: ["get_university_deadlines", "get_grades", "get_upcoming"] },

  // --- health ------------------------------------------------------------
  { id: "H1", group: "health", prompt: "What was my latest workout?", anyOf: ["get_recent_workouts", "get_health_summary"],
    forbid: ["get_finance_summary", "get_business_pipeline", "get_grades"] },
  { id: "H2", group: "health", prompt: "How is my training progressing?", anyOf: ["get_training_progress", "get_recent_workouts"] },

  // --- finance -----------------------------------------------------------
  { id: "F1", group: "finance", prompt: "What's my financial overview?", anyOf: ["get_finance_summary", "get_accounts"],
    forbid: ["get_health_summary", "get_grades", "get_recent_workouts"] },
  { id: "F2", group: "finance", prompt: "What happened with my recent transactions?", anyOf: ["get_finance_summary", "get_budget_status", "get_accounts"] },

  // --- calendar ----------------------------------------------------------
  // NB: this is JARVIS's own combined view over its own database. There is no
  // Google Calendar integration in this codebase.
  { id: "C1", group: "calendar", prompt: "What's on my calendar today?", anyOf: ["get_upcoming", "get_today_tasks"] },

  // --- memory ------------------------------------------------------------
  // NOT anyOf:["get_memory"]. buildPersonaPrefix already injects the pinned
  // memory entries into the system prompt, so answering straight from context
  // is CORRECT and calling the tool would be a redundant round trip. The 2026
  // -09-09 run failed this case while producing a perfectly grounded answer —
  // the test was wrong, not the model. What still matters is that it does not
  // go wandering through unrelated modules.
  { id: "M1", group: "memory", prompt: "What do you remember about my current priorities?",
    forbid: ["get_finance_summary", "get_health_summary", "get_recent_workouts", "get_business_pipeline"],
    maxTools: 2 },

  // --- cross-module ------------------------------------------------------
  // The actual JARVIS advantage. `maxTools` is the discipline check: a model
  // that answers "what should I focus on" by querying all eight modules has
  // failed even when the prose reads well.
  { id: "X1", group: "cross", prompt: "What should I focus on today?",
    anyOf: ["get_today_tasks", "get_overdue_tasks", "get_university_deadlines"], maxTools: 5 },
  { id: "X2", group: "cross", prompt: "Plan my evening around my university deadlines, business priorities, and tasks.",
    anyOf: ["get_university_deadlines"], maxTools: 6,
    note: "should reach university + business + tasks, and little else" },
  { id: "X3", group: "cross", prompt: "I have three hours tonight. What is the highest-value way I should use them?",
    anyOf: ["get_today_tasks", "get_overdue_tasks", "get_university_deadlines", "get_upcoming_tasks"], maxTools: 5 },
  { id: "X4", group: "cross", prompt: "Look at my upcoming university work and business pipeline and help me prioritize tomorrow.",
    anyOf: ["get_university_deadlines"], maxTools: 6 },
];

const RESET = "\x1b[0m", RED = "\x1b[31m", GREEN = "\x1b[32m", DIM = "\x1b[2m", YELLOW = "\x1b[33m";

interface ToolCall { name: string; args: Record<string, unknown>; risk: string; ok: boolean }

interface Row {
  id: string; group: string; prompt: string;
  expected: string;
  calls: ToolCall[];
  concurrency: string; response: string; pass: boolean; why: string;
}

const rows: Row[] = [];

function riskOf(name: string): string {
  return listTools().find((t) => t.name === name)?.risk ?? "unknown";
}

/** Highest permission level exercised by a turn — the brief's "permission level". */
function permissionLevel(calls: ToolCall[]): string {
  if (calls.some((c) => c.risk === "high")) return "high";
  if (calls.some((c) => c.risk === "low")) return "low";
  return calls.length ? "safe" : "-";
}

async function runCase(c: Case) {
  const supabase = createAdminClient();
  const history: MentorChatMessage[] = [{ role: "user", content: c.prompt }];

  let calls: ToolCall[] = [];
  let response = "";
  let why = "";
  let pass = true;

  try {
    const result = await runAgentTurn(supabase, history);
    // The trace carries each call's validated arguments — see
    // AgentTraceEntry. That is what makes the ARGUMENTS column real rather
    // than a guess at what the model probably sent.
    calls = result.trace.map((t) => ({ name: t.name, args: t.args, risk: riskOf(t.name), ok: t.ok }));
    response = result.text.replace(/\s+/g, " ").trim();

    const names = calls.map((c) => c.name);
    // A case with no `anyOf` asserts only the negative constraints — some
    // prompts are correctly answered from the system prompt alone.
    if (c.anyOf && !c.anyOf.some((n) => names.includes(n))) {
      pass = false;
      why = `expected one of ${c.anyOf.join("/")}`;
    }
    const forbidden = (c.forbid ?? []).filter((n) => names.includes(n));
    if (forbidden.length) {
      pass = false;
      why = `${why ? why + "; " : ""}called forbidden ${forbidden.join(", ")}`;
    }
    if (c.maxTools && names.length > c.maxTools) {
      pass = false;
      why = `${why ? why + "; " : ""}used ${names.length} tools, ceiling is ${c.maxTools}`;
    }
    // A read-only prompt must never reach a write tool.
    const wrote = calls.filter((call) => call.risk !== "safe");
    if (wrote.length) {
      pass = false;
      why = `${why ? why + "; " : ""}a read prompt called ${wrote.map((w) => w.name).join(", ")}`;
    }
    if (!response) { pass = false; why = `${why ? why + "; " : ""}empty reply`; }
  } catch (error) {
    pass = false;
    why = `threw: ${safeError(error)}`;
  }

  rows.push({
    id: c.id, group: c.group, prompt: c.prompt,
    expected: (c.anyOf ?? []).join(" | ") || "-",
    calls,
    concurrency: calls.length > 1 ? `${calls.length} tools` : calls.length === 1 ? "single" : "none",
    response, pass, why,
  });

  const mark = pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`\n${mark} ${c.id}  ${c.prompt}`);
  console.log(`     expected:   ${c.anyOf?.join(" | ") ?? "-"}${c.maxTools ? `  (max ${c.maxTools} tools)` : ""}`);
  console.log(`     actual:     ${calls.map((x) => x.name).join(", ") || DIM + "(none)" + RESET}`);
  for (const call of calls) {
    console.log(`       ${DIM}${call.name}(${JSON.stringify(call.args)}) risk=${call.risk} ok=${call.ok}${RESET}`);
  }
  console.log(`     permission: ${permissionLevel(calls)}`);
  if (why) console.log(`     ${RED}why:        ${why}${RESET}`);
  if (response) console.log(`     response:   ${DIM}${response.slice(0, 240)}${RESET}`);
}

/** Unique per run, so cleanup can never touch a record this run did not create. */
const RUN_ID = `QA-${Date.now().toString(36)}`;
const TEST_TITLE = `JARVIS-${RUN_ID} test task`;
const DECOY_TITLE = `JARVIS-${RUN_ID} decoy task`;

function verdict(ok: boolean, id: string, claim: string, detail = "") {
  console.log(`${ok ? GREEN + "PASS" : RED + "FAIL"}${RESET} ${id} ${claim}${detail ? `  ${DIM}${detail}${RESET}` : ""}`);
  return ok;
}

/** Every task this run created, by title prefix — the only rows cleanup may remove. */
async function cleanupOwnRecords(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase.from("tasks").select("id, title").like("title", `JARVIS-${RUN_ID}%`);
  for (const row of data ?? []) await supabase.from("tasks").delete().eq("id", row.id);
  console.log(`${DIM}cleaned up ${data?.length ?? 0} record(s) created by this run${RESET}`);
}

/**
 * Phase 6 — the write path, driven by the model rather than by direct SQL.
 *
 * What this creates: exactly one task titled "JARVIS-<runid> test task",
 * then updates and completes it, then deletes it. Nothing pre-existing is
 * read into, written to, or removed — cleanup matches on the run id, which
 * no earlier record can carry.
 */
async function runWriteJourney() {
  console.log(`\n${YELLOW}=== phase 6: safe writes (create → update → complete) ===${RESET}`);
  const supabase = createAdminClient();
  let allPassed = true;

  try {
    // --- create ---
    const create = await runAgentTurn(supabase, [
      { role: "user", content: `Create a task called "${TEST_TITLE}" with high priority.` },
    ]);
    const createCall = create.trace.find((t) => t.name === "create_task");
    allPassed = verdict(Boolean(createCall), "W1", "model chose create_task",
      createCall ? `args=${JSON.stringify(createCall.args)}` : `chose: ${create.trace.map((t) => t.name).join(", ") || "nothing"}`) && allPassed;

    const { data: made } = await supabase.from("tasks").select("id, title, priority, status").eq("title", TEST_TITLE).maybeSingle();
    allPassed = verdict(Boolean(made), "W2", "the task actually exists in the database",
      made ? `priority=${made.priority} status=${made.status}` : "") && allPassed;
    // Argument validation: the model had to pass the title through verbatim.
    allPassed = verdict(made?.title === TEST_TITLE, "W3", "title was passed through exactly") && allPassed;
    console.log(`     ${DIM}${create.text.slice(0, 200)}${RESET}`);

    if (!made) return allPassed;

    // --- update ---
    const update = await runAgentTurn(supabase, [
      { role: "user", content: `Change the priority of "${TEST_TITLE}" to low.` },
    ]);
    const updateCall = update.trace.find((t) => t.name === "update_task");
    allPassed = verdict(Boolean(updateCall), "W4", "model chose update_task",
      updateCall ? `args=${JSON.stringify(updateCall.args)}` : `chose: ${update.trace.map((t) => t.name).join(", ") || "nothing"}`) && allPassed;

    const { data: updated } = await supabase.from("tasks").select("priority").eq("id", made.id).maybeSingle();
    allPassed = verdict(updated?.priority === "low", "W5", "priority changed in the database", `now=${updated?.priority}`) && allPassed;
    console.log(`     ${DIM}${update.text.slice(0, 200)}${RESET}`);

    // --- complete ---
    const complete = await runAgentTurn(supabase, [
      { role: "user", content: `Mark "${TEST_TITLE}" as complete.` },
    ]);
    const completeCall = complete.trace.find((t) => t.name === "complete_task");
    allPassed = verdict(Boolean(completeCall), "W6", "model chose complete_task (not delete_task)",
      completeCall ? `args=${JSON.stringify(completeCall.args)}` : `chose: ${complete.trace.map((t) => t.name).join(", ") || "nothing"}`) && allPassed;

    const { data: done } = await supabase.from("tasks").select("status, completed_at").eq("id", made.id).maybeSingle();
    allPassed = verdict(done?.status === "done", "W7", "task is marked done in the database", `status=${done?.status}`) && allPassed;
    console.log(`     ${DIM}${complete.text.slice(0, 200)}${RESET}`);
  } finally {
    await cleanupOwnRecords(supabase);
  }
  return allPassed;
}

/**
 * Phase 7 — high-risk confirmation, against the real model.
 *
 * Creates two disposable tasks: a target and a decoy. The decoy exists to
 * test the property that matters most — that approving a deletion replays
 * the STORED pending arguments rather than reconstructing them from whatever
 * the user's confirmation message happens to say. If arguments were rebuilt
 * from the confirmation text, the decoy would be the one that disappears.
 */
async function runConfirmationJourney() {
  console.log(`\n${YELLOW}=== phase 7: high-risk confirmation ===${RESET}`);
  const supabase = createAdminClient();
  let allPassed = true;

  const { data: created, error } = await supabase
    .from("tasks")
    .insert([{ title: TEST_TITLE, status: "todo" }, { title: DECOY_TITLE, status: "todo" }])
    .select("id, title");
  if (error || !created || created.length !== 2) {
    console.log(`${RED}could not create the test tasks: ${error?.message}${RESET}`);
    return false;
  }
  const target = created.find((r) => r.title === TEST_TITLE)!;
  const decoy = created.find((r) => r.title === DECOY_TITLE)!;
  console.log(`${DIM}created target + decoy${RESET}`);

  const exists = async (id: string) =>
    Boolean((await supabase.from("tasks").select("id").eq("id", id).maybeSingle()).data);

  try {
    const history: MentorChatMessage[] = [
      { role: "user", content: `Delete the task called "${TEST_TITLE}".` },
    ];
    const proposed = await runAgentTurn(supabase, history);
    const pending = proposed.pendingConfirmation;

    allPassed = verdict(Boolean(pending), "P1", "JARVIS asked for confirmation instead of deleting",
      pending ? `summary="${pending.summary}"` : `trace: ${proposed.trace.map((t) => t.name).join(", ")}`) && allPassed;
    allPassed = verdict(await exists(target.id), "P2", "nothing was deleted at the proposal step") && allPassed;

    // "No" and "maybe" are the ABSENCE of a confirmed replay: the UI simply
    // never sends confirmedCall. Both are run through the model anyway, to
    // prove no path re-derives approval from the words themselves.
    for (const [id, reply] of [["P3", "No, don't."], ["P4", "Maybe, I'm not sure."]] as const) {
      await runAgentTurn(supabase, [...history, { role: "assistant", content: proposed.text }, { role: "user", content: reply }]);
      allPassed = verdict(await exists(target.id), id, `"${reply}" executed nothing`) && allPassed;
    }

    if (pending) {
      // The confirmation message deliberately names the DECOY. Only the
      // stored pending.args should decide what is deleted.
      const approved = await runAgentTurn(
        supabase,
        [...history, { role: "assistant", content: proposed.text }, { role: "user", content: `Yes — go ahead and delete "${DECOY_TITLE}".` }],
        { confirmedCall: { toolName: pending.toolName, args: pending.args } },
      );
      const targetGone = !(await exists(target.id));
      const decoySurvived = await exists(decoy.id);
      allPassed = verdict(targetGone, "P5", '"yes" executed the pending operation') && allPassed;
      allPassed = verdict(decoySurvived, "P6",
        "pending.args were replayed, NOT reconstructed from the confirmation message",
        `pending.args=${JSON.stringify(pending.args)}`) && allPassed;
      console.log(`     ${DIM}${approved.text.slice(0, 200)}${RESET}`);
    }
  } finally {
    await cleanupOwnRecords(supabase);
  }
  return allPassed;
}

async function main() {
  const missing = ["GEMINI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    .filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(`BLOCKED — live operator QA needs: ${missing.join(", ")}`);
    // Says where configuration was read from, because the previous message
    // implied the variables did not exist when in fact they were sitting in
    // an .env.local this process had never opened.
    console.error(describeEnvSource());
    console.error("Nothing was run. This is the one part of the suite that cannot be faked.");
    process.exit(2);
  }
  console.log(`${DIM}${describeEnvSource()}${RESET}`);

  console.log(`${YELLOW}=== read-only operator matrix ===${RESET}`);
  for (const c of READ_CASES) await runCase(c);

  let writesPassed = true;
  if (process.argv.includes("--with-writes")) {
    writesPassed = (await runWriteJourney()) && writesPassed;
    writesPassed = (await runConfirmationJourney()) && writesPassed;
  } else {
    console.log(`\n${DIM}Write journey skipped. Re-run with --with-writes to exercise create/update/complete and the confirmation gate.${RESET}`);
  }

  const passed = rows.filter((r) => r.pass).length;
  const exercised = new Set(rows.flatMap((r) => r.calls.map((c) => c.name)));
  console.log(`\n${YELLOW}=== summary ===${RESET}`);
  console.log(`${passed}/${rows.length} prompts selected an acceptable tool`);
  console.log(`${exercised.size}/${listTools().length} tools exercised by the model`);
  const never = listTools().map((t) => t.name).filter((n) => !exercised.has(n));
  if (never.length) console.log(`${DIM}never chosen: ${never.join(", ")}${RESET}`);

  console.log("\nid   group       result  perm  tools");
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(4)} ${r.group.padEnd(11)} ${(r.pass ? "pass" : "FAIL").padEnd(6)}  ${permissionLevel(r.calls).padEnd(5)} ${r.calls.map((c) => c.name).join(", ") || "-"}`,
    );
  }

  // Written alongside the run so a failing matrix can be read without
  // scrolling a terminal, and diffed against the next run.
  const reportPath = "operator-live-report.json";
  writeFileSync(reportPath, JSON.stringify({ ranAt: new Date().toISOString(), rows }, null, 2));
  console.log(`\n${DIM}full matrix written to ${reportPath}${RESET}`);

  process.exit(rows.every((r) => r.pass) && writesPassed ? 0 : 1);
}

main();
