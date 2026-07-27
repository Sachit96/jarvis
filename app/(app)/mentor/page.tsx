import { createClient } from "@/lib/supabase/server";
import { getDailyRecommendation, getGeneralMentorMessages } from "@/lib/db/queries/mentor";
import { generateDailyBriefAction } from "@/actions/mentor-actions";
import { BriefCard } from "@/components/mentor/brief-card";
import { GenerateBriefButton } from "@/components/mentor/generate-brief-button";
import { MentorChatWidget } from "@/components/mentor/mentor-chat-widget";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { MENTOR_TABS } from "@/lib/nav-items";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function MentorPage() {
  const supabase = await createClient();
  const today = todayStr();
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY);

  const [brief, messages] = await Promise.all([
    getDailyRecommendation(supabase, today),
    getGeneralMentorMessages(supabase),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">AI Mentor</p>
        <h1 className="text-xl font-semibold">Today</h1>
      </div>

      <ModuleTabs tabs={MENTOR_TABS} />

      {brief ? (
        <div className="space-y-2">
          <BriefCard
            dateLabel={`Generated for ${brief.rec_date}`}
            markdownBody={brief.markdown_body}
            focusAreas={brief.focus_areas}
            strengths={brief.strengths}
            weaknesses={brief.weaknesses}
          />
          <GenerateBriefButton action={generateDailyBriefAction} label="Regenerate today's brief" hasKey={hasGroqKey} />
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No brief for today yet — generate one from your current tasks, habits, finances, health, and pipeline.
          </p>
          <div className="flex justify-center">
            <GenerateBriefButton action={generateDailyBriefAction} label="Generate today's brief" hasKey={hasGroqKey} />
          </div>
        </div>
      )}

      <MentorChatWidget initialMessages={messages} hasKey={hasGroqKey} />
    </div>
  );
}
