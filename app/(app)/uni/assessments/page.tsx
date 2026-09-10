import { createClient } from "@/lib/supabase/server";
import { getCourses, getAssessments, getAssessmentGroups } from "@/lib/db/queries/uni";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { AssessmentForm } from "@/components/uni/assessment-form";
import { AssessmentsListClient } from "@/components/uni/assessments-list-client";
import { UNI_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";

export default async function UniAssessmentsPage() {
  const supabase = await createClient();
  const courses = await getCourses(supabase);
  const courseIds = courses.map((c) => c.id);
  const [assessments, groups] = await Promise.all([
    getAssessments(supabase, courseIds),
    getAssessmentGroups(supabase, courseIds),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="University"
        title="Assessments"
        actions={<AssessmentForm courses={courses} />}
      />

      <ModuleTabs tabs={UNI_TABS} />

      <AssessmentsListClient assessments={assessments} courses={courses} groups={groups} />
    </div>
  );
}
