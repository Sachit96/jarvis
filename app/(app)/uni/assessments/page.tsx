import { createClient } from "@/lib/supabase/server";
import { getCourses, getAssessments } from "@/lib/db/queries/uni";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { AssessmentForm } from "@/components/uni/assessment-form";
import { AssessmentsListClient } from "@/components/uni/assessments-list-client";
import { UNI_TABS } from "@/lib/nav-items";
import { PageHeader } from "@/components/shared/page-header";

export default async function UniAssessmentsPage() {
  const supabase = await createClient();
  const courses = await getCourses(supabase);
  const assessments = await getAssessments(supabase, courses.map((c) => c.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader eyebrow="University" title="Assessments" />
        <AssessmentForm courses={courses} />
      </div>

      <ModuleTabs tabs={UNI_TABS} />

      <AssessmentsListClient assessments={assessments} courses={courses} />
    </div>
  );
}
