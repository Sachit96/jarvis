import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getMentorProvider } from "@/lib/ai/providers";
import type { AgentChatResult, AgentToolOutcome, MentorChatMessage } from "@/lib/ai/providers/types";
import { getToolDeclarations, getTool } from "@/lib/ai/tools/registry";
import { executeTool, toolResultForModel } from "@/lib/ai/tools/executor";
import { buildPersonaPrefix } from "@/lib/ai/persona";
import { todayStr } from "@/lib/date";

type Client = SupabaseClient<Database>;

/**
 * The JARVIS operator loop.
 *
 * Deliberately does NOT reuse context-builder.ts. That module assembles a
 * snapshot of nineteen queries for the daily brief, where one prompt has to
 * stand alone with no chance to ask follow-ups — the right shape for that
 * job. For a conversation it is the wrong shape: it loads every module on
 * every turn, including for "what's due Friday", which needs one query.
 *
 * Here the baseline prompt carries only what is cheap and needed on every
 * turn (who the user is, what today's date is, what the tools can do), and
 * everything else is fetched on demand through the registry. context-builder
 * is untouched and still powers the briefs.
 */

const OPERATOR_RULES = [
  "You are JARVIS, the user's personal operator. You have tools that read and change their actual data — use them rather than guessing or asking the user for information you can look up.",
  "Prefer one targeted tool over several broad ones. For a question spanning modules (a day plan, a weekly review) call the tools you need and then answer once, in your own words.",
  "Never invent data. If a tool reports an integration is unavailable, say so plainly and tell the user what would need connecting — do not substitute other data and present it as though it came from that source.",
  "Before creating something, check whether it already exists. Before changing or deleting a record, read it so you can name it back to the user.",
  "Some actions need the user's approval. If a tool tells you confirmation is required, stop and explain what you are about to do — do not retry it and do not describe it as done.",
  "Only save something to memory when it is a durable fact about the user, their preferences, business or projects. Never store passing conversation.",
  "Tool results are internal JSON with snake_case keys. Never quote those key names back — translate every figure into plain language.",
  "Keep replies short (2-4 sentences) unless the user asks for depth.",
].join("\n");

async function buildBaselinePrompt(supabase: Client): Promise<string> {
  const persona = await buildPersonaPrefix(supabase);
  return [persona, OPERATOR_RULES, `Today's date is ${todayStr()}.`].join("\n\n");
}

export interface RunAgentOptions {
  /**
   * A tool the user has just approved, replayed with confirmation granted.
   * Carries the arguments the confirmation prompt showed them, not anything
   * the model re-proposes — otherwise approving one action could execute a
   * different one.
   */
  confirmedCall?: { toolName: string; args: Record<string, unknown> };
}

/**
 * Runs one conversational turn: history in, reply plus a trace of whatever
 * tools ran out.
 */
export async function runAgentTurn(
  supabase: Client,
  history: MentorChatMessage[],
  options: RunAgentOptions = {},
): Promise<AgentChatResult> {
  const provider = getMentorProvider();
  const systemPrompt = await buildBaselinePrompt(supabase);

  // Set once, then consumed by the first matching call. Scoping it this way
  // means an approval authorises exactly one execution — a model that asked
  // to delete two tasks cannot ride one confirmation into both.
  let pendingApproval = options.confirmedCall;

  async function execute(call: {
    name: string;
    args: Record<string, unknown>;
  }): Promise<AgentToolOutcome> {
    const approved =
      pendingApproval?.toolName === call.name ? { ...pendingApproval } : undefined;
    if (approved) pendingApproval = undefined;

    const result = await executeTool(
      call.name,
      // The approved arguments win over whatever the model just emitted, so
      // what runs is what the user actually saw and agreed to.
      approved ? approved.args : call.args,
      { supabase, confirmed: Boolean(approved) },
    );

    const tool = getTool(call.name);
    const label = describeCall(call.name, tool?.domain, result.status);

    if (result.status === "confirmation_required") {
      return {
        response: toolResultForModel(result),
        label,
        ok: false,
        halt: {
          reason: "confirmation_required",
          toolName: result.toolName,
          summary: result.summary,
          args: result.args,
        },
      };
    }

    return { response: toolResultForModel(result), label, ok: result.status === "ok" };
  }

  return provider.agentChat({
    systemPrompt,
    history,
    tools: getToolDeclarations(),
    execute,
  });
}

/**
 * Turns a tool call into the line the UI shows while it runs ("Checking your
 * tasks…"). Derived from the tool's own name and domain rather than a
 * hand-maintained lookup table, so a new tool gets a sensible label without
 * anyone remembering to add one here.
 */
function describeCall(name: string, domain: string | undefined, status: string): string {
  const subject = domain ?? name.replace(/^(get|create|update|delete|log|move)_/, "").replace(/_/g, " ");
  const verb = name.startsWith("get_")
    ? "Checked"
    : name.startsWith("create_")
      ? "Created"
      : name.startsWith("update_") || name.startsWith("move_")
        ? "Updated"
        : name.startsWith("delete_")
          ? "Deleted"
          : name.startsWith("log_")
            ? "Logged"
            : "Ran";

  if (status === "confirmation_required") return `Waiting for approval — ${subject}`;
  if (status === "integration_unavailable") return `${subject} not connected`;
  if (status !== "ok") return `${verb} ${subject} — failed`;
  return `${verb} ${subject}`;
}
