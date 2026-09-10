import { createClient } from "@/lib/supabase/server";
import { getGoals } from "@/lib/db/queries/life";
import { GoalForm } from "@/components/life/goal-form";
import { GoalCard } from "@/components/life/goal-card";
import { Target } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";

const SECTIONS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
] as const;

export default async function GoalsPage() {
  const supabase = await createClient();
  const goals = await getGoals(supabase);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Life" title="Goals" />

      {SECTIONS.map((section) => {
        const sectionGoals = goals.filter((g) => g.timeframe === section.key);
        return (
          <div key={section.key} className="space-y-3">
            <SectionHeader
              title={section.label}
              description={
                sectionGoals.length > 0
                  ? `${sectionGoals.filter((g) => g.status === "achieved").length} of ${sectionGoals.length} achieved`
                  : undefined
              }
              action={<GoalForm defaultTimeframe={section.key} />}
            />
            {sectionGoals.length === 0 ? (
              <div className="surface">
                <EmptyState
                  icon={Target}
                  title={`No ${section.label.toLowerCase()} objectives`}
                  description={`Set a ${section.label.toLowerCase()} goal and it will track its own progress here.`}
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {sectionGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
