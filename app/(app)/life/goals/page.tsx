import { createClient } from "@/lib/supabase/server";
import { getGoals } from "@/lib/db/queries/life";
import { GoalForm } from "@/components/life/goal-form";
import { GoalCard } from "@/components/life/goal-card";

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
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Life</p>
        <h1 className="text-xl font-semibold">Goals</h1>
      </div>

      {SECTIONS.map((section) => {
        const sectionGoals = goals.filter((g) => g.timeframe === section.key);
        return (
          <div key={section.key} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">{section.label}</h2>
              <GoalForm defaultTimeframe={section.key} />
            </div>
            {sectionGoals.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                No {section.label.toLowerCase()} goals yet.
              </p>
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
