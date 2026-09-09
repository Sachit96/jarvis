// MUST be the first import — see scripts/load-env.ts.
import "./load-env";
import { describeEnvSource } from "./load-env";
import { callGemini, TIER_MODEL, type GeminiTier } from "../lib/ai/providers/gemini-client";
import { getToolDeclarations } from "../lib/ai/tools/registry";
import { safeError } from "./safe-error";

/**
 * Isolates a Gemini failure by changing one variable at a time.
 *
 *   npm run gemini:probe
 *
 * operator:live reported "Gemini request failed: 500" on the very first turn,
 * which on its own is not diagnosable: a 500 from this endpoint can mean an
 * unsupported model, a tool declaration the API rejects, a payload it will
 * not accept at size, or a genuine outage. Those need completely different
 * fixes, so guessing between them is worthless.
 *
 * The ladder below separates them. Each step adds exactly one thing to the
 * one before it, so the first step that fails names the cause:
 *
 *   1 fails                → credentials or the model id itself
 *   2 passes, 3 fails      → that tier cannot do function calling at all
 *   3 passes, 4 fails      → something about the full 39-declaration payload
 *                            (size, or one specific declaration — step 5
 *                            then bisects to find which)
 *   all pass on one tier   → the operator should use that tier
 *
 * Read-only: every call is a trivial prompt, no tool is ever executed, and
 * nothing touches the database.
 */

const RESET = "\x1b[0m", GREEN = "\x1b[32m", RED = "\x1b[31m", YELLOW = "\x1b[33m", DIM = "\x1b[2m";

const HELLO = [{ role: "user" as const, parts: [{ text: "Reply with the single word: ready" }] }];
const ASK = [{ role: "user" as const, parts: [{ text: "What are my tasks today?" }] }];

interface Outcome { ok: boolean; detail: string }

async function attempt(label: string, run: () => Promise<string>): Promise<Outcome> {
  process.stdout.write(`  ${label.padEnd(52)}`);
  try {
    const detail = await run();
    console.log(`${GREEN}PASS${RESET} ${DIM}${detail}${RESET}`);
    return { ok: true, detail };
  } catch (error) {
    const detail = safeError(error, 300);
    console.log(`${RED}FAIL${RESET} ${detail}`);
    return { ok: false, detail };
  }
}

const summarise = (r: { text: string | null; functionCalls: { name: string }[] }) =>
  r.functionCalls.length
    ? `called ${r.functionCalls.map((c) => c.name).join(", ")}`
    : `text: ${(r.text ?? "").replace(/\s+/g, " ").slice(0, 60)}`;

async function probeTier(tier: GeminiTier) {
  console.log(`\n${YELLOW}${tier} → ${TIER_MODEL[tier]}${RESET}`);

  const plain = await attempt("1. plain text, no tools", async () =>
    summarise(await callGemini({ tier, systemInstruction: "You are terse.", contents: HELLO })));
  if (!plain.ok) return { tier, plain, oneTool: null, allTools: null };

  const declarations = getToolDeclarations();
  const oneTool = await attempt("2. one tool declaration", async () =>
    summarise(await callGemini({
      tier,
      systemInstruction: "Use a tool if one fits.",
      contents: ASK,
      tools: declarations.filter((d) => d.name === "get_today_tasks"),
    })));

  const allTools = await attempt(`3. all ${declarations.length} tool declarations`, async () =>
    summarise(await callGemini({
      tier,
      systemInstruction: "Use a tool if one fits.",
      contents: ASK,
      tools: declarations,
    })));

  return { tier, plain, oneTool, allTools };
}

/**
 * Halves the declaration list until the offending one is alone. Only worth
 * running when one tool works and all of them do not, which is the signature
 * of a single bad declaration rather than a size limit.
 */
async function bisect(tier: GeminiTier) {
  console.log(`\n${YELLOW}bisecting the declaration list${RESET}`);
  let pool = getToolDeclarations();

  const fails = async (subset: typeof pool) => {
    try {
      await callGemini({ tier, systemInstruction: "Use a tool if one fits.", contents: ASK, tools: subset });
      return false;
    } catch {
      return true;
    }
  };

  if (!(await fails(pool))) { console.log("  the full set now passes — the earlier failure was transient"); return; }

  while (pool.length > 1) {
    const half = Math.ceil(pool.length / 2);
    const [left, right] = [pool.slice(0, half), pool.slice(half)];
    if (await fails(left)) pool = left;
    else if (await fails(right)) pool = right;
    else {
      // Neither half fails alone: the problem is the combination or the size,
      // not one declaration.
      console.log(`  ${YELLOW}neither half fails alone — this is payload size, not one bad tool${RESET}`);
      console.log(`  ${DIM}smallest failing set: ${pool.length} declarations${RESET}`);
      return;
    }
    console.log(`  ${DIM}narrowed to ${pool.length}${RESET}`);
  }
  console.log(`  ${RED}the API rejects this declaration: ${pool[0].name}${RESET}`);
  console.log(`  ${DIM}${JSON.stringify(pool[0].parameters).slice(0, 400)}${RESET}`);
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("BLOCKED — gemini:probe needs GEMINI_API_KEY.");
    console.error(describeEnvSource());
    process.exit(2);
  }
  console.log(`${DIM}${describeEnvSource()}${RESET}`);
  console.log("Each step adds one thing to the previous one. The first FAIL names the cause.");

  const results = [];
  for (const tier of ["high_volume", "structured"] as GeminiTier[]) {
    results.push(await probeTier(tier));
  }

  console.log(`\n${YELLOW}=== verdict ===${RESET}`);
  for (const r of results) {
    if (!r.plain.ok) { console.log(`  ${r.tier}: unusable — ${r.plain.detail}`); continue; }
    if (r.oneTool?.ok && r.allTools?.ok) { console.log(`  ${GREEN}${r.tier}: function calling works with the full tool set${RESET}`); continue; }
    if (r.oneTool?.ok && !r.allTools?.ok) { console.log(`  ${r.tier}: one tool works, ${getToolDeclarations().length} do not — see the bisection below`); continue; }
    console.log(`  ${RED}${r.tier}: cannot do function calling at all${RESET}`);
  }

  // Only bisect where it can tell us something.
  const partial = results.find((r) => r.oneTool?.ok && r.allTools && !r.allTools.ok);
  if (partial) await bisect(partial.tier);

  const usable = results.find((r) => r.oneTool?.ok && r.allTools?.ok);
  if (usable) {
    console.log(`\n${GREEN}Use tier "${usable.tier}" for the operator.${RESET}`);
  } else {
    console.log(`\n${RED}No tier currently supports the operator's tool set.${RESET}`);
  }
}

main();
