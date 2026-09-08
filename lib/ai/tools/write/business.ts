import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { ok, type ToolDefinition } from "@/lib/ai/tools/types";

/**
 * Business writes, plus the first genuinely high-risk tool.
 *
 * log_activity and move_deal_stage are "low": both are ordinary CRM edits the
 * user can correct in the UI, and neither leaves the app. delete_task is
 * "high" because it destroys a record — which is the category the executor's
 * confirmation gate exists for, and the reason that gate is exercised by
 * real code rather than only by tests.
 */

export const logActivityTool: ToolDefinition = {
  name: "log_activity",
  description:
    "Record a call, email, meeting or note against a business contact. Get contact_id from get_contacts.",
  domain: "business",
  risk: "low",
  schema: z.object({
    contact_id: z.string().min(1).describe("Contact id from get_contacts."),
    type: z.enum(["call", "email", "meeting", "note", "other"]),
    notes: z.string().min(1).max(2000),
  }),
  async handler(args, { supabase }) {
    const a = args as { contact_id: string; type: string; notes: string };
    const { data, error } = await supabase
      .from("activities")
      .insert({ contact_id: a.contact_id, type: a.type, notes: a.notes })
      .select("id")
      .single();
    if (error) return { status: "error", message: `Could not log the activity: ${error.message}` };
    revalidatePath("/business/clients");
    return ok({ created: true, id: data.id, summary: `Logged ${a.type} activity` });
  },
};

export const moveDealStageTool: ToolDefinition = {
  name: "move_deal_stage",
  description:
    "Move a deal to a different pipeline stage. Read get_business_pipeline first for the deal id and the available stage names.",
  domain: "business",
  risk: "low",
  schema: z.object({
    deal_id: z.string().min(1),
    stage_name: z.string().min(1).describe("Exact stage name, e.g. 'Proposal Sent'."),
  }),
  async handler(args, { supabase }) {
    const { deal_id, stage_name } = args as { deal_id: string; stage_name: string };

    // Resolved by name against the real stages table rather than trusting a
    // model-supplied id: the model can only name a stage that exists, and a
    // typo comes back as a listable set instead of a foreign-key error.
    const { data: stages, error: stagesError } = await supabase
      .from("pipeline_stages")
      .select("id, name");
    if (stagesError) return { status: "error", message: `Could not read pipeline stages: ${stagesError.message}` };

    const match = stages.find((s) => s.name.toLowerCase() === stage_name.trim().toLowerCase());
    if (!match) {
      return {
        status: "invalid_arguments",
        issues: [`No stage named "${stage_name}". Available: ${stages.map((s) => s.name).join(", ")}`],
      };
    }

    const { data, error } = await supabase
      .from("deals")
      .update({ stage_id: match.id })
      .eq("id", deal_id)
      .select("id, title")
      .maybeSingle();
    if (error) return { status: "error", message: `Could not move the deal: ${error.message}` };
    if (!data) return { status: "error", message: `No deal with id ${deal_id} exists.` };
    revalidatePath("/business/pipeline");
    return ok({ updated: true, id: data.id, summary: `Moved "${data.title}" to ${match.name}` });
  },
};

export const deleteTaskTool: ToolDefinition = {
  name: "delete_task",
  description:
    "Permanently delete a task. Prefer complete_task when the user has finished something — deletion is for tasks created in error.",
  domain: "tasks",
  risk: "high",
  schema: z.object({
    task_id: z.string().min(1),
  }),
  // The user is approving a destructive act, so the prompt has to name the
  // record. "Run delete_task" would be asking them to approve an opaque id.
  summarize: (args) => `Permanently delete task ${(args as { task_id: string }).task_id}`,
  async handler(args, { supabase }) {
    const { task_id } = args as { task_id: string };
    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task_id)
      .select("id, title")
      .maybeSingle();
    if (error) return { status: "error", message: `Could not delete the task: ${error.message}` };
    if (!data) return { status: "error", message: `No task with id ${task_id} exists.` };
    revalidatePath("/life/tasks");
    revalidatePath("/");
    return ok({ deleted: true, id: data.id, summary: `Deleted "${data.title}"` });
  },
};

export const businessWriteTools = [logActivityTool, moveDealStageTool, deleteTaskTool];
