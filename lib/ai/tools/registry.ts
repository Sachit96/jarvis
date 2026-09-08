import "server-only";
import { personalReadTools } from "@/lib/ai/tools/read/personal";
import { moduleReadTools } from "@/lib/ai/tools/read/modules";
import { routineTools } from "@/lib/ai/tools/read/routines";
import { businessOpsTools } from "@/lib/ai/tools/read/business-ops";
import { personalWriteTools } from "@/lib/ai/tools/write/personal";
import { businessWriteTools } from "@/lib/ai/tools/write/business";
import { toGeminiDeclaration, type GeminiFunctionDeclaration } from "@/lib/ai/tools/gemini-schema";
import type { RiskLevel, ToolDefinition } from "@/lib/ai/tools/types";

/**
 * The whitelist.
 *
 * This array is the complete set of operations the model can reach. There is
 * no dynamic registration, no name-to-function lookup by string outside this
 * file, and no path from a model response to arbitrary SQL, an arbitrary
 * server action, or the filesystem — a tool call that does not match a name
 * here is rejected by the executor before any code runs.
 */
const ALL_TOOLS: ToolDefinition[] = [
  ...personalReadTools,
  ...moduleReadTools,
  ...routineTools,
  ...businessOpsTools,
  ...personalWriteTools,
  ...businessWriteTools,
];

/**
 * Duplicate names would make lookup order-dependent and could silently
 * shadow a safe tool with a risky one, so this fails at module load rather
 * than at the first ambiguous call.
 */
const byName = new Map<string, ToolDefinition>();
for (const tool of ALL_TOOLS) {
  if (byName.has(tool.name)) throw new Error(`Duplicate tool name: ${tool.name}`);
  byName.set(tool.name, tool);
}

/**
 * Declarations are built once, at load. Conversion throws on a schema shape
 * the converter doesn't support, so an unsupported tool breaks the server
 * immediately with its name attached — rather than reaching the model as a
 * subtly wrong declaration and surfacing later as bad tool calls.
 */
const declarations = new Map<string, GeminiFunctionDeclaration>();
for (const tool of ALL_TOOLS) {
  try {
    declarations.set(tool.name, toGeminiDeclaration(tool.name, tool.description, tool.schema));
  } catch (error) {
    throw new Error(`Tool "${tool.name}" has an unconvertible schema: ${(error as Error).message}`);
  }
}

export function getTool(name: string): ToolDefinition | undefined {
  return byName.get(name);
}

export function listTools(): ToolDefinition[] {
  return ALL_TOOLS;
}

/**
 * The model-facing tool list.
 *
 * `maxRisk` exists so a surface can expose less than the full set without a
 * second registry — the SMS webhook, for instance, has no way to render a
 * confirmation prompt, so it should offer read-only tools rather than
 * silently dead-ending on a high-risk call.
 */
export function getToolDeclarations(maxRisk: RiskLevel = "high"): GeminiFunctionDeclaration[] {
  const order: RiskLevel[] = ["safe", "low", "high"];
  const ceiling = order.indexOf(maxRisk);
  return ALL_TOOLS.filter((t) => order.indexOf(t.risk) <= ceiling).map(
    (t) => declarations.get(t.name)!,
  );
}

/** Names grouped by risk — used by the docs and the registry test. */
export function toolNamesByRisk(): Record<RiskLevel, string[]> {
  return {
    safe: ALL_TOOLS.filter((t) => t.risk === "safe").map((t) => t.name),
    low: ALL_TOOLS.filter((t) => t.risk === "low").map((t) => t.name),
    high: ALL_TOOLS.filter((t) => t.risk === "high").map((t) => t.name),
  };
}
