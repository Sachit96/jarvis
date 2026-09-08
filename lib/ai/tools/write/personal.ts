import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { todayStr } from "@/lib/date";
import { ok, type ToolDefinition, type ToolResult } from "@/lib/ai/tools/types";

/**
 * Write tools.
 *
 * These generalise the log_nutrition_entry pattern: the model chooses the
 * operation and the arguments, and the write happens here, server-side,
 * against an explicit column list. The model never supplies a table name, a
 * query, or a column set.
 *
 * Risk levels follow types.ts. Creating a task or logging a meal is "low" —
 * the user can delete it in two clicks and it touches only their own
 * records. Anything that leaves the app or destroys data is "high" and stops
 * at the executor's confirmation gate.
 *
 * Field shapes mirror lib/validations/life.ts and memory.ts rather than
 * importing them directly: those schemas are built for HTML form input
 * (coercion from strings, empty-string-to-null) and carry validation
 * messages written for a form field. Re-stating the model-facing shape here
 * keeps the tool declaration clean, and each handler still writes the same
 * columns the form actions write.
 */

/** Every write returns the created row's id so the model can reference it in follow-ups. */
function created(id: string, summary: string): ToolResult {
  return ok({ created: true, id, summary });
}

export const createTaskTool: ToolDefinition = {
  name: "create_task",
  description:
    "Create a task for the user. Check get_tasks first if there's a chance it already exists.",
  domain: "tasks",
  risk: "low",
  schema: z.object({
    title: z.string().min(1).max(200).describe("Short imperative title, e.g. 'Study ECN 104 chapter 5'"),
    description: z.string().max(2000).optional(),
    priority: z.enum(["high", "medium", "low"]).optional().describe("Defaults to medium."),
    due_date: z
      .string()
      .optional()
      .describe("Due date as yyyy-mm-dd. Omit if the user did not give one — do not guess."),
    tags: z.array(z.string().max(40)).max(10).optional(),
  }),
  async handler(args, { supabase }) {
    const a = args as {
      title: string;
      description?: string;
      priority?: "high" | "medium" | "low";
      due_date?: string;
      tags?: string[];
    };
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: a.title,
        description: a.description ?? null,
        priority: a.priority ?? "medium",
        due_date: a.due_date ?? null,
        tags: a.tags ?? [],
      })
      .select("id")
      .single();
    if (error) return { status: "error", message: `Could not create the task: ${error.message}` };
    // Keeps the Tasks page and Home's priority widget in step with a change
    // the user made by talking rather than clicking.
    revalidatePath("/life/tasks");
    revalidatePath("/");
    return created(data.id, `Created task "${a.title}"`);
  },
};

export const completeTaskTool: ToolDefinition = {
  name: "complete_task",
  description: "Mark an existing task as done. Get the id from get_tasks or get_today_tasks first.",
  domain: "tasks",
  risk: "low",
  schema: z.object({
    task_id: z.string().min(1).describe("The task's id, from get_tasks."),
  }),
  async handler(args, { supabase }) {
    const { task_id } = args as { task_id: string };
    const { data, error } = await supabase
      .from("tasks")
      // Mirrors toggleTaskStatusAction: status and completed_at move together,
      // or the Tasks page shows a done task with no completion timestamp.
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", task_id)
      .select("id, title")
      .maybeSingle();
    if (error) return { status: "error", message: `Could not complete the task: ${error.message}` };
    // maybeSingle rather than single: a hallucinated id should come back as a
    // clear "no such task" the model can recover from, not a thrown error.
    if (!data) return { status: "error", message: `No task with id ${task_id} exists.` };
    revalidatePath("/life/tasks");
    revalidatePath("/");
    return ok({ completed: true, id: data.id, summary: `Completed "${data.title}"` });
  },
};

export const updateTaskTool: ToolDefinition = {
  name: "update_task",
  description: "Change an existing task's title, priority, due date or description.",
  domain: "tasks",
  risk: "low",
  schema: z.object({
    task_id: z.string().min(1),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    priority: z.enum(["high", "medium", "low"]).optional(),
    due_date: z.string().optional().describe("yyyy-mm-dd"),
  }),
  async handler(args, { supabase }) {
    const a = args as {
      task_id: string;
      title?: string;
      description?: string;
      priority?: "high" | "medium" | "low";
      due_date?: string;
    };
    // Built field by field rather than by spreading the parsed object: only
    // the keys the model actually sent should be written, and an explicit
    // shape is what keeps this assignable to the generated table types —
    // a Record<string, string> would let a typo reach the database.
    const patch: {
      title?: string;
      description?: string;
      priority?: string;
      due_date?: string;
    } = {};
    if (a.title !== undefined) patch.title = a.title;
    if (a.description !== undefined) patch.description = a.description;
    if (a.priority !== undefined) patch.priority = a.priority;
    if (a.due_date !== undefined) patch.due_date = a.due_date;

    if (Object.keys(patch).length === 0) {
      return { status: "invalid_arguments", issues: ["Provide at least one field to change."] };
    }
    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", a.task_id)
      .select("id, title")
      .maybeSingle();
    if (error) return { status: "error", message: `Could not update the task: ${error.message}` };
    if (!data) return { status: "error", message: `No task with id ${a.task_id} exists.` };
    revalidatePath("/life/tasks");
    return ok({ updated: true, id: data.id, summary: `Updated "${data.title}"` });
  },
};

export const createGoalTool: ToolDefinition = {
  name: "create_goal",
  description: "Create a goal. Goals are longer-lived than tasks and carry a progress percentage.",
  domain: "goals",
  risk: "low",
  schema: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    timeframe: z.enum(["daily", "weekly", "monthly"]),
    category: z.string().max(80).optional(),
    target_date: z.string().optional().describe("yyyy-mm-dd"),
  }),
  async handler(args, { supabase }) {
    const a = args as {
      title: string;
      description?: string;
      timeframe: string;
      category?: string;
      target_date?: string;
    };
    const { data, error } = await supabase
      .from("goals")
      .insert({
        title: a.title,
        description: a.description ?? null,
        timeframe: a.timeframe,
        category: a.category ?? null,
        target_date: a.target_date ?? null,
        progress_percent: 0,
      })
      .select("id")
      .single();
    if (error) return { status: "error", message: `Could not create the goal: ${error.message}` };
    revalidatePath("/life/goals");
    return created(data.id, `Created goal "${a.title}"`);
  },
};

export const updateGoalProgressTool: ToolDefinition = {
  name: "update_goal_progress",
  description: "Set a goal's progress percentage (0-100).",
  domain: "goals",
  risk: "low",
  schema: z.object({
    goal_id: z.string().min(1),
    progress_percent: z.number().min(0).max(100),
  }),
  async handler(args, { supabase }) {
    const { goal_id, progress_percent } = args as { goal_id: string; progress_percent: number };
    const { data, error } = await supabase
      .from("goals")
      .update({ progress_percent: Math.round(progress_percent) })
      .eq("id", goal_id)
      .select("id, title")
      .maybeSingle();
    if (error) return { status: "error", message: `Could not update the goal: ${error.message}` };
    if (!data) return { status: "error", message: `No goal with id ${goal_id} exists.` };
    revalidatePath("/life/goals");
    return ok({ updated: true, id: data.id, summary: `Set "${data.title}" to ${Math.round(progress_percent)}%` });
  },
};

export const logNutritionTool: ToolDefinition = {
  name: "log_nutrition_entry",
  description:
    "Log a meal into the nutrition diary with estimated macros. Estimate rather than interrogating the user, unless the description is too vague to estimate at all.",
  domain: "health",
  risk: "low",
  schema: z.object({
    meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    description: z.string().min(1).max(500),
    calories: z.number().min(0).max(10000),
    protein_g: z.number().min(0).max(1000),
    carbs_g: z.number().min(0).max(1000),
    fat_g: z.number().min(0).max(1000),
  }),
  async handler(args, { supabase }) {
    const a = args as {
      meal_type: string;
      description: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    };
    const { error } = await supabase.from("nutrition_logs").insert({
      meal_type: a.meal_type,
      description: a.description,
      calories: Math.round(a.calories),
      protein_g: a.protein_g,
      carbs_g: a.carbs_g,
      fat_g: a.fat_g,
      source: "chatbot",
      logged_at: todayStr(),
    });
    if (error) return { status: "error", message: `Could not log the meal: ${error.message}` };
    revalidatePath("/health/nutrition");
    return ok({ logged: true, summary: `Logged ${a.description} (${Math.round(a.calories)} kcal)` });
  },
};

/**
 * Memory writes are deliberately narrow.
 *
 * The model may persist a durable fact when the user states one, but it does
 * not get a general "remember this conversation" capability — an assistant
 * that writes every exchange to memory turns a curated store into a
 * transcript dump and buries the entries the user actually wanted kept.
 * `source: "captured"` marks AI-written entries so they stay distinguishable
 * from ones the user wrote by hand.
 */
export const rememberTool: ToolDefinition = {
  name: "remember",
  description:
    "Persist a durable fact, preference or piece of context the user has stated about themselves, their business or their projects. Only use for information that stays true beyond this conversation — never for chat history, one-off questions, or anything the user asked you to keep private.",
  domain: "memory",
  risk: "low",
  schema: z.object({
    type: z.enum(["fact", "preference", "person", "project", "protocol", "reference"]),
    title: z.string().min(1).max(200).describe("Short label, e.g. 'Prefers morning workouts'"),
    body: z.string().min(1).max(4000),
    tags: z.array(z.string().max(40)).max(20).optional(),
  }),
  async handler(args, { supabase }) {
    const a = args as { type: string; title: string; body: string; tags?: string[] };
    const { data, error } = await supabase
      .from("memory_entries")
      .insert({
        type: a.type,
        title: a.title,
        body: a.body,
        tags: a.tags ?? [],
        source: "captured",
        pinned: false,
      })
      .select("id")
      .single();
    if (error) return { status: "error", message: `Could not save that to memory: ${error.message}` };
    revalidatePath("/memory");
    return created(data.id, `Remembered "${a.title}"`);
  },
};

export const personalWriteTools = [
  createTaskTool,
  updateTaskTool,
  completeTaskTool,
  createGoalTool,
  updateGoalProgressTool,
  logNutritionTool,
  rememberTool,
];
