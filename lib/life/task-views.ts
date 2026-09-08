/**
 * Grouping and filtering for the Tasks module.
 *
 * Pure functions over rows the caller already fetched — no Supabase, no
 * dates read from the clock — so the "is this overdue" rule is testable and
 * has exactly one definition. The Tasks page, Home's priority widget and
 * the get_overdue_tasks tool were each deciding it separately.
 */

export interface TaskLike {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  tags: string[];
  completed_at?: string | null;
}

export type TaskBucket = "overdue" | "today" | "upcoming" | "someday" | "done";

export const BUCKET_LABEL: Record<TaskBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  someday: "No date",
  done: "Done",
};

/**
 * Which bucket a task belongs in, given today's date as `yyyy-mm-dd`.
 *
 * Dates are compared as strings throughout. due_date is a DATE column
 * rendered as ISO, which sorts lexicographically, and parsing to a Date
 * would reintroduce the timezone shift the app's date helpers exist to
 * avoid — a task due "today" becoming "overdue" for anyone west of UTC.
 *
 * A task with no due date is "someday", never overdue: it was never
 * promised for a particular day, and burying it in the overdue pile makes
 * that pile meaningless.
 */
export function bucketFor(task: TaskLike, today: string): TaskBucket {
  if (task.status === "done") return "done";
  if (!task.due_date) return "someday";
  if (task.due_date < today) return "overdue";
  if (task.due_date === today) return "today";
  return "upcoming";
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * Sorts within a bucket: soonest first, then by priority.
 *
 * Date before priority, because within a bucket the deadline is the thing
 * that is actually forcing the order — a low-priority item due today still
 * has to happen before a high-priority one due next week.
 */
export function compareTasks(a: TaskLike, b: TaskLike): number {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) {
    return a.due_date < b.due_date ? -1 : 1;
  }
  const rank = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
  if (rank !== 0) return rank;
  return a.title.localeCompare(b.title);
}

export interface GroupedTasks {
  overdue: TaskLike[];
  today: TaskLike[];
  upcoming: TaskLike[];
  someday: TaskLike[];
  done: TaskLike[];
}

export function groupTasks(tasks: TaskLike[], today: string): GroupedTasks {
  const grouped: GroupedTasks = { overdue: [], today: [], upcoming: [], someday: [], done: [] };
  for (const task of tasks) grouped[bucketFor(task, today)].push(task);
  for (const key of Object.keys(grouped) as TaskBucket[]) grouped[key].sort(compareTasks);
  return grouped;
}

export interface TaskFilter {
  /** Free text over title, description and tags. */
  query?: string;
  priority?: "high" | "medium" | "low";
  tag?: string;
}

/**
 * Client-side filtering.
 *
 * Case-insensitive and substring-based, which is right for a personal
 * backlog of tens-to-hundreds of rows: it needs no round trip and no index,
 * and the whole list is already loaded. If this ever has to scale past that
 * it belongs in the query layer, not here.
 */
export function filterTasks(tasks: TaskLike[], filter: TaskFilter): TaskLike[] {
  const query = filter.query?.trim().toLowerCase();
  return tasks.filter((task) => {
    if (filter.priority && task.priority !== filter.priority) return false;
    if (filter.tag && !task.tags.includes(filter.tag)) return false;
    if (!query) return true;
    const haystack = [task.title, task.description ?? "", ...task.tags].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

/** Every distinct tag in use, for a filter control. */
export function collectTags(tasks: TaskLike[]): string[] {
  return [...new Set(tasks.flatMap((t) => t.tags))].sort();
}

/**
 * The "what should I look at" shortlist, as a pure function over tasks
 * already in hand.
 *
 * Extracted because Home fetched the whole tasks table twice per render:
 * once through getPriorityTasks (which selects every unfinished task and
 * then slices in memory anyway) and once through getTasks for the buckets
 * and the priority line. One list can answer both.
 *
 * Ordering matches what getPriorityTasks always did — priority first, due
 * date within it — and relies on a stable sort, which every runtime this
 * targets guarantees.
 */
export function selectPriorityTasks<T extends TaskLike>(tasks: T[], limit = 5): T[] {
  return [...tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      // Undated tasks sort last: a date is a commitment, no date is a wish.
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    })
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99))
    .slice(0, limit);
}
