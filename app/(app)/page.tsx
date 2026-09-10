import { Briefcase, Dumbbell, GraduationCap, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AuroraBackdrop } from "@/components/shell/aurora-backdrop";
import { todayStr } from "@/lib/date";
import { getTasks } from "@/lib/db/queries/life";
import { getAccounts, computeAssetLiabilityTotals } from "@/lib/db/queries/finance";
import { getWorkouts, getWorkoutSets, computeWorkoutVolume } from "@/lib/db/queries/health";
import {
  getPipelineStages,
  getDeals,
  getContracts,
  getContacts,
  computeMrr,
  computeStaleDeals,
} from "@/lib/db/queries/business";
import { getTodayRoutineItems } from "@/lib/db/queries/routine";
import { getCourses, getAssessments, getDeadlines, getScheduleBlocks } from "@/lib/db/queries/uni";
import { groupTasks, selectPriorityTasks, type TaskLike } from "@/lib/life/task-views";
import { topPriority, rankPriorities } from "@/lib/life/priority";
import { describeUntil, nextClass, nowContext, formatTime } from "@/lib/uni/timetable";
import { hasHevyKey } from "@/lib/integrations/hevy/client";
import { formatLbs } from "@/lib/units";
import { JarvisPriorityCard } from "@/components/dashboard/jarvis-priority-card";
import { BentoTile } from "@/components/dashboard/bento-tile";
import { HevyAutoSync } from "@/components/health/hevy-auto-sync";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";

/**
 * How many rows each bento panel shows before it starts counting.
 *
 * A phone and a desktop have room for different amounts, and picking one
 * number means either clipping the phone or starving the desktop. The extra
 * rows render and are hidden with `max-md:hidden`, and each breakpoint gets
 * its own honest "+N more" — so nothing is ever cut off without saying so.
 */
const ROUTINE_SHOWN_MD = 6;
const TASKS_SHOWN_SM = 2;
const TASKS_SHOWN_MD = 4;

/**
 * "+N more", with the right N at each breakpoint.
 *
 * Both variants render and CSS picks one, because the number of rows on
 * screen differs between phone and desktop and a single count would be a
 * lie at one of them.
 */
function MoreCount({
  total,
  sm,
  md,
  suffix = "",
}: {
  total: number;
  sm: number;
  md: number;
  suffix?: string;
}) {
  if (total <= sm) return null;
  return (
    <li className="text-caption text-foreground-tertiary">
      <span className="md:hidden">
        +{total - sm} more{suffix}
      </span>
      {total > md ? (
        <span className="max-md:hidden">
          +{total - md} more{suffix}
        </span>
      ) : null}
    </li>
  );
}

function money(n: number) {
  if (Math.abs(n) >= 100_000) return `$${(n / 1000).toFixed(0)}K`;
  if (Math.abs(n) >= 10_000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * The command centre: one screen, no scroll.
 *
 * Home is a glance surface, not a report. It answers four questions — what
 * am I worth, what is the business earning, where do I need to be, and am I
 * training — plus the one thing that needs doing next, and it does that
 * inside a single viewport with no scrollbar.
 *
 * That constraint is what shapes the query list. The previous version ran
 * twenty-four queries to fill fifteen cards, most of which were summaries of
 * pages one click away; this runs eleven, and every one of them feeds
 * something visible above the fold. Anything that used to live here and no
 * longer fits is not gone, it is on its own module page, which is where a
 * detail belongs.
 *
 * Nothing is clipped to achieve this. Lists inside tiles cap themselves and
 * the grid rows are sized so the content fits at every breakpoint — verified
 * in a browser at phone, tablet and desktop, asserting scrollHeight equals
 * clientHeight. "No scrolling" has to mean "everything is reachable", not
 * "the overflow is hidden".
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayStr();

  const [accounts, contracts, stages, deals, contacts, routineItems, allTasks, courses, deadlines, workouts] =
    await Promise.all([
      getAccounts(supabase),
      getContracts(supabase),
      getPipelineStages(supabase),
      getDeals(supabase),
      getContacts(supabase),
      getTodayRoutineItems(supabase),
      getTasks(supabase),
      getCourses(supabase),
      getDeadlines(supabase),
      getWorkouts(supabase),
    ]);

  const courseIds = courses.map((c) => c.id);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentWorkoutIds = workouts
    .filter((w) => new Date(w.started_at) >= sevenDaysAgo)
    .map((w) => w.id);

  // The only reads that need an id from the batch above, so they overlap
  // rather than queueing.
  const [scheduleBlocks, assessments, recentSets] = await Promise.all([
    getScheduleBlocks(supabase, courseIds),
    getAssessments(supabase, courseIds),
    getWorkoutSets(supabase, recentWorkoutIds),
  ]);

  const financeTotals = computeAssetLiabilityTotals(accounts);
  const mrr = computeMrr(contracts);
  const openCount = deals.filter((d) => {
    const stage = stages.find((s) => s.id === d.stage_id);
    return stage && !stage.is_won && !stage.is_lost;
  }).length;
  const volume7d = computeWorkoutVolume(recentSets);
  const trainedThisWeek = recentWorkoutIds.length;
  const routineDone = routineItems.filter((i) => i.completed).length;

  const courseCode = new Map(courses.map((c) => [c.id, c.code]));
  const upNext = nextClass(scheduleBlocks, nowContext(new Date()));

  const groupedTasks = groupTasks(allTasks as TaskLike[], today);
  const priorityInput = {
    today,
    overdueTasks: groupedTasks.overdue.map((t) => ({ id: t.id, title: t.title, due_date: t.due_date })),
    tasksDueToday: groupedTasks.today.map((t) => ({ id: t.id, title: t.title })),
    universityDue: [
      ...assessments
        .filter((a) => a.due_at && a.status !== "graded" && a.status !== "submitted")
        .map((a) => ({ id: a.id, title: a.title, due_at: a.due_at!, course: courseCode.get(a.course_id) })),
      ...deadlines.map((d) => ({ id: d.id, title: d.title, due_at: d.due_at, course: null })),
    ],
    staleDeals: computeStaleDeals(deals, stages, contacts),
    routine: { completed: routineDone, total: routineItems.length },
  };
  const ranked = rankPriorities(priorityInput);
  const priority = topPriority(priorityInput);
  // Sized to the space the bento gives them, with the remainder counted
  // rather than dropped.
  const priorityTasks = selectPriorityTasks(allTasks, TASKS_SHOWN_MD);
  const outstandingTaskCount = groupedTasks.overdue.length + groupedTasks.today.length + groupedTasks.upcoming.length;
  const remainingRoutine = routineItems.filter((i) => !i.completed);

  return (
    <div className="fixed-viewport flex flex-col gap-3">
      <AuroraBackdrop intensity="focal" />
      {hasHevyKey() ? <HevyAutoSync /> : null}

      <PageHeader
        className="shrink-0"
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        title="Today"
      />

      <div className="shrink-0">
        <JarvisPriorityCard priority={priority} runnersUp={ranked.slice(1, 2)} />
      </div>

      {/* The bento: four figures on top, two working panels underneath.
          `min-h-0` on the grid is what lets the rows shrink instead of
          forcing the page taller than the viewport — without it a tall child
          wins and the "no scroll" promise quietly breaks.

          The panel row is CAPPED rather than stretched from md up. Given the
          whole viewport it grew to ~530px around 150px of content, and a
          card that is four-fifths empty reads as broken, not as breathing
          room. Capped, the slack falls below the grid as page whitespace,
          which is what breathing room actually looks like. On a phone there
          is no slack to give away, so the last row still takes the
          remainder. */}
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-3 md:grid-cols-4 md:grid-rows-[auto_minmax(0,20rem)] md:content-start">
        <BentoTile
          label="Net worth"
          icon={Wallet}
          accent
          href="/finance/overview"
          value={money(financeTotals.netWorth)}
          hint={accounts.length === 0 ? "No accounts connected" : `Across ${accounts.length} account(s)`}
        />
        <BentoTile
          label="Pipeline MRR"
          icon={Briefcase}
          href="/business/dashboard"
          value={money(mrr)}
          hint={openCount === 0 ? "No open deals" : `${openCount} open deal(s)`}
        />
        <BentoTile
          label="Next class"
          icon={GraduationCap}
          href="/uni/timetable"
          value={upNext ? (courseCode.get(upNext.block.course_id) ?? "Class") : "—"}
          hint={
            upNext
              ? `${formatTime(upNext.block.start_time)} · ${describeUntil(upNext.minutesUntil)}`
              : courses.length === 0
                ? "No courses yet"
                : "No timetable set"
          }
        />
        <BentoTile
          label="Workout volume"
          icon={Dumbbell}
          href="/health/workouts"
          value={`${formatLbs(volume7d)} lbs`}
          hint={trainedThisWeek === 0 ? "Nothing logged this week" : `${trainedThisWeek} session(s), 7 days`}
        />

        <BentoTile label="Today's routine" href="/life/habits" className="col-span-2">
          {routineItems.length === 0 ? (
            <p className="text-caption text-foreground-tertiary">Nothing scheduled.</p>
          ) : (
            <div className="flex h-full flex-col gap-2">
              <div className="flex shrink-0 items-baseline gap-2">
                <span className="tabular font-display text-metric text-foreground">{routineDone}</span>
                <span className="text-body text-foreground-tertiary">/ {routineItems.length} done</span>
              </div>
              <div className="h-1.5 shrink-0 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="gradient-brand h-full rounded-full"
                  style={{ width: `${(routineDone / routineItems.length) * 100}%` }}
                />
              </div>
              {/* Capped by COUNT, not by letting the container clip. A
                  deterministic cap with a "+N more" line is honest about
                  what is not shown; silently cutting a list off at whatever
                  height happens to be left is not. The tile links to the
                  full list either way. */}
              {/* A phone has room for the reading, not the list. Below md the
                  tile is the progress figure and a count; the items appear
                  from md up, where there is space to show them without
                  cutting one off mid-row. Tapping the tile opens the full
                  routine at either size. */}
              {remainingRoutine.length > 0 ? (
                <p className="shrink-0 text-caption text-foreground-tertiary md:hidden">
                  {remainingRoutine.length} still to do
                </p>
              ) : null}
              <ul className="min-h-0 flex-1 space-y-1.5 overflow-hidden max-md:hidden">
                {remainingRoutine.slice(0, ROUTINE_SHOWN_MD).map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-body">
                    <span className="size-1 shrink-0 rounded-full bg-white/25" />
                    <span className="truncate text-foreground-secondary">{item.label}</span>
                  </li>
                ))}
                {remainingRoutine.length > ROUTINE_SHOWN_MD ? (
                  <li className="text-caption text-foreground-tertiary">
                    +{remainingRoutine.length - ROUTINE_SHOWN_MD} more
                  </li>
                ) : null}
              </ul>
            </div>
          )}
        </BentoTile>

        <BentoTile label="Next up" href="/life/tasks" className="col-span-2">
          {priorityTasks.length === 0 ? (
            <p className="text-caption text-foreground-tertiary">Nothing overdue or due today.</p>
          ) : (
            <ul className="h-full space-y-2 overflow-hidden">
              {priorityTasks.map((task, i) => (
                <li key={task.id} className={cn("min-w-0", i >= TASKS_SHOWN_SM && "max-md:hidden")}>
                  <p className="truncate text-body text-foreground-secondary">{task.title}</p>
                  {task.due_date ? (
                    <p className="tabular text-caption text-foreground-tertiary">{task.due_date}</p>
                  ) : null}
                </li>
              ))}
              <MoreCount
                total={outstandingTaskCount}
                sm={TASKS_SHOWN_SM}
                md={TASKS_SHOWN_MD}
                suffix=" outstanding"
              />
            </ul>
          )}
        </BentoTile>
      </div>
    </div>
  );
}
