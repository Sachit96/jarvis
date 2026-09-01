import { GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCourses, getAssessments } from "@/lib/db/queries/uni";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { CourseForm } from "@/components/uni/course-form";
import { CourseCard } from "@/components/uni/course-card";
import { UNI_TABS } from "@/lib/nav-items";

export default async function UniCoursesPage() {
  const supabase = await createClient();
  const courses = await getCourses(supabase);
  const assessments = await getAssessments(supabase, courses.map((c) => c.id));

  const currentTerm = courses[0]?.term;
  const byTerm = new Map<string, typeof courses>();
  for (const c of courses) {
    if (!byTerm.has(c.term)) byTerm.set(c.term, []);
    byTerm.get(c.term)!.push(c);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">University</p>
          <h1 className="text-xl font-semibold">Courses</h1>
        </div>
        <CourseForm term={currentTerm} />
      </div>

      <ModuleTabs tabs={UNI_TABS} />

      {courses.length === 0 ? (
        <EmptyState title="No courses yet" description="Add your first course to start tracking it." icon={GraduationCap} />
      ) : (
        Array.from(byTerm.entries()).map(([term, termCourses]) => (
          <div key={term} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{term}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {termCourses.map((course) => (
                <CourseCard key={course.id} course={course} assessments={assessments.filter((a) => a.course_id === course.id)} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
