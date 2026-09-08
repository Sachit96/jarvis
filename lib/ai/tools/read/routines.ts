import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getHabits, getHabitLogsForHeatmap, getTasks } from "@/lib/db/queries/life";
import { getTodayRoutineItems } from "@/lib/db/queries/routine";
import { cadenceStreak, describeCadence, isDueOn } from "@/lib/life/routine-cadence";
import { groupTasks, filterTasks, type TaskLike } from "@/lib/life/task-views";
import { todayStr } from "@/lib/date";
import { ok, type ToolDefinition } from "@/lib/ai/tools/types";

/**
 * Routine and task-view tools.
 *
 * These wrap the same pure helpers the pages use (groupTasks, isDueOn,
 * cadenceStreak), so what JARVIS calls "overdue" and what the Tasks page
 * shows under Overdue are the same set by construction rather than by two
 * implementations agreeing.
 */

export const getRoutinesTool: ToolDefinition = {
  name: "get_routines",
  description:
    "The user's routine checklist for today — which items are due, which are done, each item's streak and how often it recurs.",
  domain: "tasks",
  risk: "safe",
  schema: z.object({}),
  async handler(_args, { supabase }) {
    const items = await getTodayRoutineItems(supabase);
    return ok({
      date: todayStr(),
      // Only items due today are returned at all, so "remaining" is a real
      // count of what is left rather than of everything ever configured.
      completed: items.filter((i) => i.completed).length,
      total: items.length,
      items: items.map((i) => ({
        id: i.id,
        label: i.label,
        completed: i.completed,
        kind: i.kind,
        streak: i.streak,
        cadence: i.cadence,
      })),
    });
  },
};

export const completeRoutineTool: ToolDefinition = {
  name: "complete_routine",
  description:
    "Tick off a routine item for today. Only works for manual items — get the id from get_routines. Items marked 'auto' are derived from other data (workouts, nutrition, journal) and complete themselves.",
  domain: "tasks",
  risk: "low",
  schema: z.object({
    routine_id: z.string().min(1).describe("The routine item's id, from get_routines."),
  }),
  async handler(args, { supabase }) {
    const { routine_id } = args as { routine_id: string };

    // Auto items have synthetic ids ("auto-workout") and no habit row.
    // Rejecting them explicitly is clearer than a foreign-key error, and
    // tells the model what to do instead.
    if (routine_id.startsWith("auto-")) {
      return {
        status: "invalid_arguments",
        issues: [
          `"${routine_id}" is an automatic item — it completes itself when the underlying activity is logged. Log the workout, meal or journal entry instead.`,
        ],
      };
    }

    const today = todayStr();
    const { data, error } = await supabase
      .from("habit_logs")
      // Upsert on the (habit_id, log_date) unique constraint: ticking a
      // routine twice in a day must be idempotent, not a duplicate-key error.
      .upsert(
        { habit_id: routine_id, log_date: today, completed: true, completed_at: new Date().toISOString() },
        { onConflict: "habit_id,log_date" },
      )
      .select("id")
      .maybeSingle();

    if (error) return { status: "error", message: `Could not update the routine: ${error.message}` };
    if (!data) return { status: "error", message: `No routine item with id ${routine_id} exists.` };

    revalidatePath("/life/habits");
    revalidatePath("/");
    return ok({ completed: true, id: routine_id, summary: "Routine item ticked off for today" });
  },
};

export const getUpcomingTasksTool: ToolDefinition = {
  name: "get_upcoming_tasks",
  description:
    "Open tasks grouped into overdue, due today, and upcoming. Use this for 'what's on', planning a day, or before creating tasks so you don't duplicate one.",
  domain: "tasks",
  risk: "safe",
  schema: z.object({
    query: z.string().optional().describe("Free-text filter over title, description and tags."),
    priority: z.enum(["high", "medium", "low"]).optional(),
  }),
  async handler(args, { supabase }) {
    const { query, priority } = args as { query?: string; priority?: "high" | "medium" | "low" };
    const tasks = (await getTasks(supabase)) as TaskLike[];
    const grouped = groupTasks(filterTasks(tasks, { query, priority }), todayStr());

    const project = (list: TaskLike[]) =>
      list.map((t) => ({ id: t.id, title: t.title, priority: t.priority, due_date: t.due_date, tags: t.tags }));

    return ok({
      today: todayStr(),
      overdue: project(grouped.overdue),
      due_today: project(grouped.today),
      upcoming: project(grouped.upcoming),
      // Undated work is deliberately separate: it is a backlog, not a
      // schedule, and folding it into "upcoming" would make a day plan
      // look far fuller than it is.
      no_due_date: project(grouped.someday),
    });
  },
};

export const getRoutineHistoryTool: ToolDefinition = {
  name: "get_routine_history",
  description:
    "How consistently the user has kept each routine recently — completions against the days it was actually due, plus the current streak.",
  domain: "tasks",
  risk: "safe",
  schema: z.object({
    days: z.number().optional().describe("How far back to look. Defaults to 30."),
  }),
  async handler(args, { supabase }) {
    const { days } = args as { days?: number };
    const window = Math.min(Math.max(days ?? 30, 1), 180);
    const today = todayStr();

    const habits = await getHabits(supabase);
    const logs = await getHabitLogsForHeatmap(supabase, habits.map((h) => h.id), window);

    const completedByHabit = new Map<string, Set<string>>();
    for (const log of logs) {
      if (!log.completed) continue;
      const set = completedByHabit.get(log.habit_id) ?? new Set<string>();
      set.add(log.log_date);
      completedByHabit.set(log.habit_id, set);
    }

    const from = new Date(`${today}T00:00:00`);
    from.setDate(from.getDate() - window + 1);
    const fromIso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;

    return ok({
      window_days: window,
      routines: habits.map((h) => {
        const completed = completedByHabit.get(h.id) ?? new Set<string>();
        // Denominator is days the routine was DUE, not calendar days —
        // otherwise a weekly routine reports ~14% adherence at best.
        const dueDays: string[] = [];
        const cursor = new Date(`${fromIso}T00:00:00`);
        const end = new Date(`${today}T00:00:00`);
        for (let guard = 0; guard < 200 && cursor <= end; guard++) {
          const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
          if (isDueOn(h, iso)) dueDays.push(iso);
          cursor.setDate(cursor.getDate() + 1);
        }
        const done = dueDays.filter((d) => completed.has(d)).length;
        return {
          id: h.id,
          name: h.name,
          cadence: describeCadence(h),
          due_days: dueDays.length,
          completed_days: done,
          missed_days: dueDays.length - done,
          current_streak: cadenceStreak(h, completed, today),
        };
      }),
    });
  },
};

export const routineTools = [
  getRoutinesTool,
  completeRoutineTool,
  getUpcomingTasksTool,
  getRoutineHistoryTool,
];
