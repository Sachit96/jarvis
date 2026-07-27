import { createClient } from "@/lib/supabase/server";
import { getLatestWeeklyReview } from "@/lib/db/queries/mentor";
import { generateWeeklyReviewAction } from "@/actions/mentor-actions";
import { BriefCard } from "@/components/mentor/brief-card";
import { GenerateBriefButton } from "@/components/mentor/generate-brief-button";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { MENTOR_TABS } from "@/lib/nav-items";

export default async function WeeklyReviewPage() {
  const supabase = await createClient();
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
  const review = await getLatestWeeklyReview(supabase);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">AI Mentor</p>
        <h1 className="text-xl font-semibold">Weekly Review</h1>
      </div>

      <ModuleTabs tabs={MENTOR_TABS} />

      {review ? (
        <div className="space-y-2">
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
            hasKey={hasGroqKey}
          />
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No weekly review yet — generate one from this week&apos;s activity across every module.
          </p>
          <div className="flex justify-center">
            <GenerateBriefButton
              action={generateWeeklyReviewAction}
              label="Generate this week's review"
              hasKey={hasGroqKey}
            />
          </div>
        </div>
      )}
    </div>
  );
}
