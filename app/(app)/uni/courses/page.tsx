import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCourses, getAssessments, getAssessmentGroups } from "@/lib/db/queries/uni";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { CourseForm } from "@/components/uni/course-form";
import { CourseCard } from "@/components/uni/course-card";
import { UNI_TABS } from "@/lib/nav-items";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";

export default async function UniCoursesPage() {
  const supabase = await createClient();
  // Archived courses are fetched here and split out below. Without this the
  // archive control on a course page was a one-way door: the course vanished
  // from every list and there was no route back to un-archive it.
  const allCourses = await getCourses(supabase, { includeArchived: true });
  const courses = allCourses.filter((c) => !c.archived);
  const archivedCourses = allCourses.filter((c) => c.archived);
  const courseIds = allCourses.map((c) => c.id);
  const [assessments, groups] = await Promise.all([getAssessments(supabase, courseIds), getAssessmentGroups(supabase, courseIds)]);

  const currentTerm = courses[0]?.term;
  const byTerm = new Map<string, typeof courses>();
  for (const c of courses) {
    if (!byTerm.has(c.term)) byTerm.set(c.term, []);
    byTerm.get(c.term)!.push(c);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="University"
        title="Courses"
        actions={<CourseForm term={currentTerm} />}
      />

      <ModuleTabs tabs={UNI_TABS} />

      {courses.length === 0 ? (
        <EmptyState title="No courses yet" description="Add your first course to start tracking it." icon={GraduationCap} />
      ) : (
        Array.from(byTerm.entries()).map(([term, termCourses]) => (
          <div key={term} className="space-y-3">
            <SectionHeader title={term} />
            <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {termCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  assessments={assessments.filter((a) => a.course_id === course.id)}
                  groups={groups.filter((g) => g.course_id === course.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {archivedCourses.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader
            title="Archived"
            description="Finished terms. Open one and restore it to bring it back into the lists above."
          />
          <ul className="surface divide-y divide-white/[0.05]">
            {archivedCourses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/uni/courses/${course.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full opacity-60"
                    style={{ backgroundColor: course.color ?? "var(--brand)" }}
                  />
                  <span className="min-w-0 flex-1 truncate text-body text-foreground-secondary">
                    {course.code} — {course.name}
                  </span>
                  <span className="shrink-0 text-caption text-foreground-tertiary">{course.term}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
