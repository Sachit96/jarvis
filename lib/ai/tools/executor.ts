import "server-only";
import { getTool } from "@/lib/ai/tools/registry";
import type { ToolContext, ToolResult } from "@/lib/ai/tools/types";

/**
 * The single gate every model-initiated call goes through.
 *
 *   MODEL → TOOL SELECTION → VALIDATION → RISK GATE → HANDLER → RESULT
 *
 * Nothing here trusts the model. The name is looked up in the registry
 * (so an invented name cannot reach any code), the arguments are parsed by
 * the tool's own Zod schema (so extra or malformed fields are rejected
 * rather than passed through to a query), and high-risk tools stop unless
 * the *caller* — never the model — marked the call confirmed.
 *
 * Every path returns a structured ToolResult. Nothing throws to the caller,
 * because the result is fed back to the model as a tool response and a
 * thrown stack trace would either crash the turn or get summarised into a
 * hallucinated success.
 */
export async function executeTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) {
    // Names come from the model, so this is reachable and not an assertion.
    return { status: "error", message: `Unknown tool "${name}". It is not available.` };
  }

  const parsed = tool.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return {
      status: "invalid_arguments",
      issues: parsed.error.issues.map((i) => {
        const where = i.path.length > 0 ? i.path.join(".") : "(root)";
        return `${where}: ${i.message}`;
      }),
    };
  }

  // The risk gate sits AFTER validation so the confirmation prompt shows the
  // user the parsed, coerced arguments — what would actually be written —
  // rather than whatever the model happened to emit.
  if (tool.risk === "high" && !ctx.confirmed) {
    return {
      status: "confirmation_required",
      toolName: tool.name,
      summary: tool.summarize?.(parsed.data) ?? `Run ${tool.name}`,
      args: parsed.data as Record<string, unknown>,
    };
  }

  try {
    return await tool.handler(parsed.data, ctx);
  } catch (error) {
    // Deliberately does not forward the raw message: handler errors can carry
    // Postgres detail (column names, constraint text) that is noise to the
    // model and leaks schema into a transcript. The real error is logged
    // server-side for debugging.
    console.error(`[ai/tools] ${tool.name} failed:`, error);
    return { status: "error", message: `The ${tool.name} operation failed. The data was not changed.` };
  }
}

/**
 * Flattens a result into what the model actually receives back.
 *
 * The model needs to be able to tell "no data" from "couldn't look" —
 * conflating them is how an assistant ends up inventing grades for an
 * unconnected LMS — so unavailable integrations and errors keep an explicit
 * status rather than being reduced to an empty array.
 */
export function toolResultForModel(result: ToolResult): Record<string, unknown> {
  switch (result.status) {
    case "ok":
      return { ok: true, data: result.data };
    case "invalid_arguments":
      return { ok: false, error: "invalid_arguments", issues: result.issues };
    case "integration_unavailable":
      return {
        ok: false,
        error: "integration_unavailable",
        integration: result.integration,
        state: result.state,
        message: result.message,
      };
    case "confirmation_required":
      return {
        ok: false,
        error: "confirmation_required",
        message: `Waiting for the user to approve: ${result.summary}. Do not retry; tell them what you are about to do.`,
      };
    case "error":
      return { ok: false, error: "error", message: result.message };
  }
}
