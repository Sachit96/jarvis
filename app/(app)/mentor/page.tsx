import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDailyRecommendation, getGeneralMentorMessages } from "@/lib/db/queries/mentor";
import { generateDailyBriefAction } from "@/actions/mentor-actions";
import { BriefCard } from "@/components/mentor/brief-card";
import { GenerateBriefButton } from "@/components/mentor/generate-brief-button";
import { MentorChatWidget } from "@/components/mentor/mentor-chat-widget";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { MENTOR_TABS } from "@/lib/nav-items";
import { todayStr } from "@/lib/date";

export default async function MentorPage() {
  const supabase = await createClient();
  const today = todayStr();
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  const [brief, messages] = await Promise.all([
    getDailyRecommendation(supabase, today),
    getGeneralMentorMessages(supabase),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-label uppercase tracking-wide text-muted-foreground">AI Mentor</p>
        <h1 className="text-title">Today</h1>
      </div>

      <ModuleTabs tabs={MENTOR_TABS} />

      {/* Brief and chat side by side rather than stacked. Stacked, the chat
          sat below a brief long enough to push it off screen, so asking a
          follow-up about the brief meant scrolling away from the thing you
          were asking about. Side by side they're readable together, and the
          chat sticks so it stays reachable while the brief scrolls. */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-7">
          {brief ? (
            <>
              <BriefCard
                dateLabel={`Generated for ${brief.rec_date}`}
                markdownBody={brief.markdown_body}
                focusAreas={brief.focus_areas}
                strengths={brief.strengths}
                weaknesses={brief.weaknesses}
              />
              <GenerateBriefButton action={generateDailyBriefAction} label="Regenerate today's brief" hasKey={hasGeminiKey} />
            </>
          ) : (
            <div className="rounded-2xl bg-card ring-1 ring-border">
              <EmptyState
                icon={Sparkles}
                title="No brief yet today"
                description="Generate one from your current tasks, habits, finances, health, and pipeline."
                action={<GenerateBriefButton action={generateDailyBriefAction} label="Generate today's brief" hasKey={hasGeminiKey} />}
              />
            </div>
          )}
        </div>

        {/* top-19 clears the 14-unit sticky topbar plus the page's own top
            padding, so the chat pins just below the header rather than
            under it. */}
        <div className="xl:sticky xl:top-19 xl:col-span-5">
          <MentorChatWidget initialMessages={messages} hasKey={hasGeminiKey} />
        </div>
      </div>
    </div>
  );
}
