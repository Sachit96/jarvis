import { createClient } from "@/lib/supabase/server";
import { todayStr } from "@/lib/date";
import {
  getNutritionTargets,
  getNutritionLogsForDate,
  computeMacroTotals,
  getWaterTotalForDate,
  getMentorMessages,
} from "@/lib/db/queries/health";
import { NutritionTargetsForm } from "@/components/health/nutrition-targets-form";
import { MacroProgressBars } from "@/components/health/macro-progress-bars";
import { WaterTracker } from "@/components/health/water-tracker";
import { MealLogForm } from "@/components/health/meal-log-form";
import { MealLogItem } from "@/components/health/meal-log-item";
import { MentorChat } from "@/components/health/mentor-chat";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { HEALTH_TABS } from "@/lib/nav-items";

const MEAL_SECTIONS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snacks" },
] as const;

export default async function NutritionPage() {
  const supabase = await createClient();
  const today = todayStr();
  const [targets, logs, waterTotal, mentorMessages] = await Promise.all([
    getNutritionTargets(supabase),
    getNutritionLogsForDate(supabase, today),
    getWaterTotalForDate(supabase, today),
    getMentorMessages(supabase),
  ]);
  const totals = computeMacroTotals(logs);
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Health</p>
          <h1 className="text-xl font-semibold">Nutrition</h1>
        </div>
        <NutritionTargetsForm targets={targets} />
      </div>

      <ModuleTabs tabs={HEALTH_TABS} />

      <MacroProgressBars totals={totals} targets={targets} />
      <WaterTracker totalMl={waterTotal} targetMl={targets?.target_water_ml ?? 2500} />

      <div className="space-y-5">
        {MEAL_SECTIONS.map((section) => {
          const sectionLogs = logs.filter((l) => l.meal_type === section.key);
          return (
            <div key={section.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">{section.label}</h2>
                <MealLogForm defaultMealType={section.key} />
              </div>
              {sectionLogs.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-card px-4 py-4 text-center text-xs text-muted-foreground">
                  Nothing logged yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sectionLogs.map((log) => (
                    <MealLogItem key={log.id} log={log} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <MentorChat initialMessages={mentorMessages} hasKey={hasGeminiKey} />
    </div>
  );
}
