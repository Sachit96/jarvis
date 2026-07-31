import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLatestWeeklyReview } from "@/lib/db/queries/mentor";
import { generateWeeklyReviewAction } from "@/actions/mentor-actions";
import { BriefCard } from "@/components/mentor/brief-card";
import { GenerateBriefButton } from "@/components/mentor/generate-brief-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { MENTOR_TABS } from "@/lib/nav-items";

export default async function WeeklyReviewPage() {
  const supabase = await createClient();
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  const review = await getLatestWeeklyReview(supabase);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">AI Mentor</p>
        <h1 className="text-xl font-semibold">Weekly Review</h1>
      </div>

      <ModuleTabs tabs={MENTOR_TABS} />

      {review ? (
        <div className="space-y-3">
          <BriefCard
            dateLabel={`${review.week_start_date} → ${review.week_end_date}`}
            markdownBody={review.markdown_body}
            focusAreas={review.focus_areas}
            strengths={review.strengths}
            weaknesses={review.weaknesses}
          />
          <GenerateBriefButton
            action={generateWeeklyReviewAction}
            label="Regenerate this week's review"
            hasKey={hasGeminiKey}
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-card ring-1 ring-border">
          <EmptyState
            icon={CalendarClock}
            title="No weekly review yet"
            description="Generate one from this week's activity across every module."
            action={
              <GenerateBriefButton
                action={generateWeeklyReviewAction}
                label="Generate this week's review"
                hasKey={hasGeminiKey}
              />
            }
          />
        </div>
      )}
    </div>
  );
}
