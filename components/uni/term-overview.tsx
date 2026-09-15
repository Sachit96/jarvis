import { CalendarRange, Mail, MapPin, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

interface CourseLike {
  id: string;
  code: string;
  name: string;
  professor: string | null;
  professor_email: string | null;
  room: string | null;
  term: string;
  term_start: string | null;
  term_end: string | null;
  color: string | null;
}

/** Whole days between two calendar dates, ignoring time of day. */
function daysBetween(a: Date, b: Date) {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * How far through the term you are, from the course rows themselves.
 *
 * Takes the earliest start and the latest end across courses, because a
 * semester's courses do not all run to the same dates and the term is the
 * span that covers them. Returns null when no course has term dates, so the
 * caller can say "not set" rather than render a bar at 0% that looks like a
 * term that has not started.
 */
function termProgress(courses: CourseLike[]) {
  const starts = courses.map((c) => c.term_start).filter((d): d is string => !!d);
  const ends = courses.map((c) => c.term_end).filter((d): d is string => !!d);
  if (starts.length === 0 || ends.length === 0) return null;

  // Parsed with an explicit local time — a bare YYYY-MM-DD is read as UTC
  // midnight and lands a day early west of UTC.
  const start = new Date(`${starts.sort()[0]}T00:00:00`);
  const end = new Date(`${ends.sort().at(-1)}T00:00:00`);
  const total = daysBetween(start, end);
  if (total <= 0) return null;

  const elapsed = Math.min(Math.max(daysBetween(start, new Date()), 0), total);
  return {
    percent: (elapsed / total) * 100,
    weeksElapsed: Math.floor(elapsed / 7),
    weeksTotal: Math.ceil(total / 7),
    daysLeft: total - elapsed,
  };
}

/**
 * The semester at a glance: how far through it you are, and who teaches what.
 *
 * Both come straight off uni_courses — `term_start`/`term_end` and the
 * professor columns have been in the schema and on the course form since the
 * module was built, and nothing surfaced them anywhere.
 */
export function TermOverview({ courses }: { courses: CourseLike[] }) {
  const progress = termProgress(courses);
  const withInstructors = courses.filter((c) => c.professor);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card padding="compact">
        <p className="eyebrow">Term progress</p>
        {progress ? (
          <>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="tabular font-display text-metric text-foreground">
                Week {progress.weeksElapsed + 1}
              </span>
              <span className="text-body text-foreground-tertiary">of {progress.weeksTotal}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="gradient-brand h-full rounded-full" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="mt-2 text-caption text-foreground-tertiary">
              {progress.daysLeft === 0
                ? "Final day of term."
                : `${progress.daysLeft} day${progress.daysLeft === 1 ? "" : "s"} of term remaining`}
            </p>
          </>
        ) : (
          <EmptyState
            compact
            icon={CalendarRange}
            title="Term dates not set"
            description="Add a start and end date to a course and the semester tracks itself here."
          />
        )}
      </Card>

      <Card padding="compact">
        <p className="eyebrow">Instructors</p>
        {withInstructors.length === 0 ? (
          <EmptyState
            compact
            icon={UserRound}
            title="No instructors recorded"
            description="Add a professor to a course and they appear here with their room and contact."
          />
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {withInstructors.map((course) => (
              <li key={course.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-body text-foreground-secondary">
                    <span className="text-foreground-tertiary">{course.code} · </span>
                    {course.professor}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-foreground-tertiary">
                    {course.room ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" strokeWidth={2} />
                        {course.room}
                      </span>
                    ) : null}
                    {course.professor_email ? (
                      <a
                        href={`mailto:${course.professor_email}`}
                        className="inline-flex items-center gap-1 hover:text-brand hover:underline"
                      >
                        <Mail className="size-3" strokeWidth={2} />
                        Email
                      </a>
                    ) : null}
                  </div>
                </div>
                <span
                  aria-hidden
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: course.color ?? "var(--brand)" }}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
