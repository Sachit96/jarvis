import "server-only";
import { z } from "zod";
import { getTasks, getGoals, getPriorityTasks } from "@/lib/db/queries/life";
import { getTodayRoutineItems } from "@/lib/db/queries/routine";
import { getUpcoming } from "@/lib/db/queries/command-center";
import { getMemoryEntries } from "@/lib/db/queries/memory";
import { todayStr } from "@/lib/date";
import { ok, type ToolDefinition } from "@/lib/ai/tools/types";

/**
 * Read tools for tasks, goals, routine, calendar and memory.
 *
 * Every one of these wraps a query function that already exists and is
 * already used by a page. The tool layer orchestrates; it does not
 * reimplement domain logic, and it does not reach for Supabase directly —
 * that keeps one definition of "what a priority task is" instead of two
 * that drift.
 *
 * Results are projected down to the fields worth reasoning about. Handing
 * the model whole rows wastes context on ids and timestamps it never uses,
 * and buries the fields it does.
 */

const empty = z.object({});

export const getTasksTool: ToolDefinition = {
  name: "get_tasks",
  description:
    "Every open task, as a flat list. Use for the whole backlog — 'everything on my list', 'what am I carrying' — and as the duplicate check before create_task. For anything organised by when it is due, use get_upcoming_tasks instead.",
  domain: "tasks",
  risk: "safe",
  schema: z.object({
    include_completed: z.boolean().optional().describe("Include tasks already done. Defaults to false."),
  }),
  async handler(args, { supabase }) {
    const { include_completed } = args as { include_completed?: boolean };
    const tasks = await getTasks(supabase);
    // Completion is a status string plus a completed_at timestamp (see
    // toggleTaskStatusAction) — there is no boolean column.
    const rows = include_completed ? tasks : tasks.filter((t) => t.status !== "done");
    return ok(
      rows.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        due_date: t.due_date,
        status: t.status,
        tags: t.tags,
      })),
    );
  },
};

export const getTodayTasksTool: ToolDefinition = {
  name: "get_today_tasks",
  description:
    "A short shortlist of the highest-priority open tasks, plus today's routine checklist. Use for 'what should I do right now' and 'what's on today'. This is the narrow answer; use get_upcoming_tasks when the question spans more than today.",
  domain: "tasks",
  risk: "safe",
  schema: empty,
  async handler(_args, { supabase }) {
    const [priority, routine] = await Promise.all([
      getPriorityTasks(supabase, 10),
      getTodayRoutineItems(supabase),
    ]);
    return ok({
      date: todayStr(),
      priority_tasks: priority.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        due_date: t.due_date,
      })),
      routine: routine.map((r) => ({ label: r.label, completed: r.completed })),
    });
  },
};

export const getOverdueTasksTool: ToolDefinition = {
  name: "get_overdue_tasks",
  description: "Only the tasks whose due date has already passed. Use when the user asks specifically about what is late or overdue — it is cheaper than get_upcoming_tasks, which also returns them grouped with everything else.",
  domain: "tasks",
  risk: "safe",
  schema: empty,
  async handler(_args, { supabase }) {
    const today = todayStr();
    const tasks = await getTasks(supabase);
    // String comparison is correct here: due_date is a DATE column rendered
    // as ISO yyyy-mm-dd, which sorts lexicographically. Parsing to Date
    // would reintroduce the timezone-shift bug the date helpers exist to avoid.
    const overdue = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < today);
    return ok(
      overdue.map((t) => ({ id: t.id, title: t.title, priority: t.priority, due_date: t.due_date })),
    );
  },
};

export const getGoalsTool: ToolDefinition = {
  name: "get_goals",
  description:
    "The user's goals with progress percentages, timeframes and target dates. Use for progress questions and to check whether something is already tracked as a goal.",
  domain: "goals",
  risk: "safe",
  schema: empty,
  async handler(_args, { supabase }) {
    const goals = await getGoals(supabase);
    return ok(
      goals.map((g) => ({
        id: g.id,
        title: g.title,
        timeframe: g.timeframe,
        category: g.category,
        progress_percent: g.progress_percent,
        target_date: g.target_date,
      })),
    );
  },
};

export const getUpcomingTool: ToolDefinition = {
  name: "get_upcoming",
  description:
    "The user's combined upcoming schedule across every module — deadlines, assessments and dated tasks. This is JARVIS's calendar view.",
  domain: "calendar",
  risk: "safe",
  schema: z.object({
    limit: z.number().optional().describe("How many items to return. Defaults to 10."),
  }),
  async handler(args, { supabase }) {
    const { limit } = args as { limit?: number };
    // Clamped: the model can pass anything, and an unbounded limit here
    // would let one tool call pull the whole calendar into context.
    const items = await getUpcoming(supabase, Math.min(Math.max(limit ?? 10, 1), 50));
    return ok(items);
  },
};

export const getMemoryTool: ToolDefinition = {
  name: "get_memory",
  description:
    "The user's long-term memory: facts, preferences, people, projects, protocols and references they have chosen to persist. Check here before asking the user something they may have already told JARVIS.",
  domain: "memory",
  risk: "safe",
  schema: z.object({
    type: z
      .enum(["fact", "preference", "person", "project", "protocol", "reference"])
      .optional()
      .describe("Filter to one kind of memory."),
  }),
  async handler(args, { supabase }) {
    const { type } = args as { type?: string };
    const entries = await getMemoryEntries(supabase);
    const rows = type ? entries.filter((e) => e.type === type) : entries;
    return ok(
      rows.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        body: e.body,
        tags: e.tags,
        pinned: e.pinned,
      })),
    );
  },
};

export const personalReadTools = [
  getTasksTool,
  getTodayTasksTool,
  getOverdueTasksTool,
  getGoalsTool,
  getUpcomingTool,
  getMemoryTool,
];
