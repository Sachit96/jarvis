// MUST be the first import — see scripts/load-env.ts.
import "./load-env";
import { describeEnvSource } from "./load-env";
import {
  TIER_MODEL,
  buildGeminiRequestBody,
  geminiEndpoint,
  type GeminiTier,
} from "../lib/ai/providers/gemini-client";
import { getToolDeclarations } from "../lib/ai/tools/registry";
import type { GeminiFunctionDeclaration } from "../lib/ai/tools/gemini-schema";
import { redactSecrets } from "../lib/redact";

/**
 * Isolated function-calling diagnostic. Diagnosis only — it fixes nothing.
 *
 *   npm run gemini:probe
 *
 * Every request is built by buildGeminiRequestBody, the same function
 * callGemini uses, so what is tested here is exactly what production sends.
 *
 * It deliberately does NOT go through callGemini, for two reasons: callGemini
 * records usage through a Supabase RPC (a database write, which a diagnostic
 * must not perform), and it reduces the response to a short string, when the
 * whole point here is the complete error body.
 *
 * Nothing executes: no tool handler is ever invoked, no row is read or
 * written, no external integration is touched. The only network calls are to
 * generativelanguage.googleapis.com.
 *
 * STATIC FINDING THIS IS BUILT TO TEST
 *
 * 13 of the 39 declarations carry `parameters: {type:"OBJECT", properties:{},
 * required:[]}` — the shape produced for a tool that takes no arguments.
 * Gemini's OpenAPI subset rejects a declaration with an empty `properties`
 * object; a no-argument function must omit `parameters` altogether. Steps 3
 * and 4 below are an A/B on exactly that, which settles it in two calls
 * rather than by bisecting thirty-nine.
 */

const RESET = "\x1b[0m", GREEN = "\x1b[32m", RED = "\x1b[31m", YELLOW = "\x1b[33m", DIM = "\x1b[2m";

const PROMPT = [{ role: "user" as const, parts: [{ text: "Reply with exactly: OK" }] }];
const SYSTEM = "You are terse.";

/**
 * A minimal, certainly-valid declaration. Never executed — the model only has
 * to demonstrate that the API accepts it.
 */
const TEST_PING: GeminiFunctionDeclaration = {
  name: "test_ping",
  description: "A diagnostic no-op. Never call this.",
  parameters: { type: "OBJECT", properties: { input: { type: "STRING" } }, required: [] },
};

interface Result {
  label: string;
  ok: boolean;
  httpStatus: number | null;
  model: string;
  endpoint: string;
  toolCount: number;
  errorCode?: number;
  errorStatus?: string;
  errorMessage?: string;
  errorDetails?: unknown;
  rawBody?: unknown;
  transportError?: string;
}

const results: Result[] = [];

async function send(
  label: string,
  tier: GeminiTier,
  tools: GeminiFunctionDeclaration[] | undefined,
  { quiet = false } = {},
): Promise<Result> {
  const model = TIER_MODEL[tier];
  const endpoint = geminiEndpoint(model);
  const body = buildGeminiRequestBody({ tier, systemInstruction: SYSTEM, contents: PROMPT, tools });

  const base: Result = { label, ok: false, httpStatus: null, model, endpoint, toolCount: tools?.length ?? 0 };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Header, never the URL — a key in a query string ends up in logs.
        "x-goog-api-key": process.env.GEMINI_API_KEY as string,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const result = { ...base, transportError: error instanceof Error ? error.message : String(error) };
    if (!quiet) report(result);
    results.push(result);
    return result;
  }

  const text = await response.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = text; }

  const envelope = (parsed as { error?: { code?: number; message?: string; status?: string; details?: unknown } })?.error;

  const result: Result = {
    ...base,
    ok: response.ok,
    httpStatus: response.status,
    errorCode: envelope?.code,
    errorStatus: envelope?.status,
    errorMessage: envelope?.message,
    errorDetails: envelope?.details,
    rawBody: response.ok ? undefined : parsed,
  };
  if (!quiet) report(result);
  results.push(result);
  return result;
}

/** Full error body, minus anything credential-shaped. */
function report(r: Result) {
  const mark = r.ok ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`\n  ${mark} ${r.label}`);
  console.log(`       model=${r.model}  tools=${r.toolCount}  http=${r.httpStatus ?? "—"}`);
  if (r.transportError) {
    console.log(`       ${RED}transport: ${redactSecrets(r.transportError)}${RESET}`);
    return;
  }
  if (r.ok) return;
  if (r.errorStatus || r.errorCode) console.log(`       error: ${r.errorStatus ?? ""} (code ${r.errorCode ?? "—"})`);
  if (r.errorMessage) console.log(`       message: ${redactSecrets(r.errorMessage)}`);
  if (r.errorDetails) console.log(`       details: ${redactSecrets(JSON.stringify(r.errorDetails))}`);
  if (r.rawBody !== undefined) {
    console.log(`       ${DIM}full body:${RESET}`);
    console.log(redactSecrets(JSON.stringify(r.rawBody, null, 2)).split("\n").map((l) => `       ${DIM}${l}${RESET}`).join("\n"));
  }
}

const hasProperties = (d: GeminiFunctionDeclaration) =>
  Object.keys((d.parameters as { properties?: object }).properties ?? {}).length > 0;

async function runTier(tier: GeminiTier) {
  console.log(`\n${YELLOW}════ ${tier} → ${TIER_MODEL[tier]} ════${RESET}`);
  const all = getToolDeclarations();
  const withProps = all.filter(hasProperties);
  const withoutProps = all.filter((d) => !hasProperties(d));

  const a = await send("A. plain text, no tools", tier, undefined);
  if (!a.ok) {
    console.log(`\n  ${YELLOW}Plain text failed — stopping this tier. The cause is credentials,`);
    console.log(`  the model id, the endpoint or the request format, NOT tool declarations.${RESET}`);
    return { tier, a, b: null, c: null, d: null, e: null };
  }

  const b = await send("B. one minimal synthetic tool (test_ping)", tier, [TEST_PING]);
  const c = await send(`C. one REAL tool WITH properties (${withProps[0]?.name})`, tier, withProps.slice(0, 1));
  const d = await send(`D. one REAL tool with EMPTY properties (${withoutProps[0]?.name})`, tier, withoutProps.slice(0, 1));
  const e = await send(`E. all ${all.length} real tools`, tier, all);

  return { tier, a, b, c, d, e };
}

/** Only meaningful when C and D disagree — that is the whole hypothesis. */
function interpret(r: Awaited<ReturnType<typeof runTier>>): string {
  if (!r.a.ok) return "unusable before tools are involved";
  if (r.b && !r.b.ok) return "rejects function calling outright — even one minimal valid declaration";
  if (r.c?.ok && r.d && !r.d.ok) return "PROVEN: rejects declarations whose properties object is empty";
  if (r.c?.ok && r.d?.ok && r.e && !r.e.ok) return "individual declarations fine — the full payload is not (size, or a combination)";
  if (r.e?.ok) return "function calling works with the full tool set";
  return "inconclusive — read the bodies above";
}

/**
 * Halves the list until the smallest failing set is found. Only worth running
 * when single declarations pass and all of them do not.
 */
async function bisect(tier: GeminiTier) {
  console.log(`\n${YELLOW}════ bisecting ════${RESET}`);
  let pool = getToolDeclarations();
  const fails = async (subset: GeminiFunctionDeclaration[]) =>
    !(await send(`  subset of ${subset.length}`, tier, subset, { quiet: true })).ok;

  while (pool.length > 1) {
    const half = Math.ceil(pool.length / 2);
    const [left, right] = [pool.slice(0, half), pool.slice(half)];
    if (await fails(left)) pool = left;
    else if (await fails(right)) pool = right;
    else {
      console.log(`  ${YELLOW}Neither half fails alone at ${pool.length} declarations.${RESET}`);
      console.log(`  That is the signature of a SIZE/COMPLEXITY limit, not one bad declaration.`);
      console.log(`  ${DIM}smallest failing set: ${pool.map((d) => d.name).join(", ")}${RESET}`);
      return;
    }
    console.log(`  narrowed to ${pool.length}: ${DIM}${pool.map((d) => d.name).join(", ")}${RESET}`);
  }
  console.log(`\n  ${RED}The API rejects this single declaration: ${pool[0].name}${RESET}`);
  console.log(`  ${DIM}${JSON.stringify(pool[0].parameters)}${RESET}`);
  await send(`  ${pool[0].name} alone`, tier, pool);
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("BLOCKED — gemini:probe needs GEMINI_API_KEY.");
    console.error(describeEnvSource());
    process.exit(2);
  }
  console.log(`${DIM}${describeEnvSource()}${RESET}`);

  const all = getToolDeclarations();
  const empty = all.filter((d) => !hasProperties(d));
  console.log(`\n${YELLOW}Static analysis${RESET}`);
  console.log(`  ${all.length} declarations; ${empty.length} have an EMPTY properties object:`);
  console.log(`  ${DIM}${empty.map((d) => d.name).join(", ")}${RESET}`);
  console.log(`  Steps C and D below are the A/B that proves whether that is the cause.`);

  const runs = [];
  for (const tier of ["high_volume", "structured"] as GeminiTier[]) runs.push(await runTier(tier));

  console.log(`\n${YELLOW}════ matrix ════${RESET}`);
  console.log("model                    plain  synth  real+props  real-empty  all-39");
  for (const r of runs) {
    const cell = (x: Result | null | undefined) => (!x ? "  —   " : x.ok ? ` ${GREEN}PASS${RESET} ` : ` ${RED}FAIL${RESET} `);
    console.log(
      `${TIER_MODEL[r.tier].padEnd(24)}${cell(r.a)} ${cell(r.b)} ${cell(r.c)}     ${cell(r.d)}    ${cell(r.e)}`,
    );
  }
  console.log("");
  for (const r of runs) console.log(`  ${TIER_MODEL[r.tier]}: ${interpret(r)}`);

  // Bisect only where it can still tell us something the A/B did not.
  const needsBisect = runs.find((r) => r.c?.ok && r.d?.ok && r.e && !r.e.ok);
  if (needsBisect) await bisect(needsBisect.tier);

  console.log(`\n${DIM}Diagnosis only — nothing was changed and no tool was executed.${RESET}`);
}

main();
