import "server-only";
import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { IntegrationState } from "@/lib/integrations/status";

export type Client = SupabaseClient<Database>;

/**
 * How much damage a tool can do if the model picks it wrongly.
 *
 * This is the only thing that decides whether a call runs on its own, so it
 * is a property of the tool definition — not something the prompt asks the
 * model to respect. A model that has been talked into ignoring an
 * instruction still cannot get past the executor.
 *
 * - safe: reads. No state changes. Always auto-executes.
 * - low:  writes the user can trivially undo in the UI, and that only touch
 *         their own records — a task, a nutrition entry. Auto-executes.
 * - high: anything that leaves the app (email, SMS, external API mutation),
 *         touches money, or destroys a record. NEVER auto-executes.
 */
export type RiskLevel = "safe" | "low" | "high";

/** Modules a tool belongs to — drives grouping in the UI and nothing else. */
export type ToolDomain =
  | "tasks"
  | "goals"
  | "business"
  | "finance"
  | "university"
  | "health"
  | "calendar"
  | "memory";

/**
 * Re-exported rather than redeclared. A second copy of this union drifted
 * from the canonical one immediately — it was missing "syncing" — and the
 * whole point of the status system is that Settings, Home, Voice and the
 * model describe an integration the same way.
 */
export type { IntegrationState } from "@/lib/integrations/status";

export type ToolResult =
  | { status: "ok"; data: unknown }
  /** Argument validation failed. `issues` is safe to show the model. */
  | { status: "invalid_arguments"; issues: string[] }
  /** Ran, but the data source isn't wired up. Never a crash, never a guess. */
  | { status: "integration_unavailable"; integration: string; state: IntegrationState; message: string }
  /** High-risk call the user has not approved yet. Carries the args back so the UI can render what it would do. */
  | { status: "confirmation_required"; toolName: string; summary: string; args: Record<string, unknown> }
  /** The handler threw, or the domain operation failed. Message is sanitised. */
  | { status: "error"; message: string };

export interface ToolContext {
  supabase: Client;
  /**
   * True only when the user has explicitly approved THIS call. The executor
   * requires it for every high-risk tool; nothing else can set it, and the
   * model has no way to pass it.
   */
  confirmed?: boolean;
}

/**
 * One whitelisted operation.
 *
 * The zod schema is the single source of truth for the shape: it validates
 * incoming arguments AND is converted to the model-facing declaration, so
 * the two cannot drift. The existing LOG_NUTRITION_TOOL comment warns about
 * exactly that drift when a shape is written out twice.
 */
export interface ToolDefinition<TSchema extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  domain: ToolDomain;
  risk: RiskLevel;
  schema: TSchema;
  /**
   * One line describing what the call would do, shown in the confirmation
   * prompt. Required for high-risk tools so the user is never asked to
   * approve an opaque call.
   */
  summarize?: (args: z.infer<TSchema>) => string;
  handler: (args: z.infer<TSchema>, ctx: ToolContext) => Promise<ToolResult>;
}

/** Convenience for handlers whose happy path is just "here is the data". */
export function ok(data: unknown): ToolResult {
  return { status: "ok", data };
}

export function unavailable(
  integration: string,
  state: IntegrationState,
  message: string,
): ToolResult {
  return { status: "integration_unavailable", integration, state, message };
}
