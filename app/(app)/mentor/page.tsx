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
    <div className="space-y-8">
      <div>
        <p className="text-label uppercase tracking-wide text-muted-foreground">AI Mentor</p>
        <h1 className="text-title">Today</h1>
      </div>

      <ModuleTabs tabs={MENTOR_TABS} />

      {brief ? (
        <div className="space-y-3">
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
        <div className="rounded-2xl bg-card ring-1 ring-white/[0.06]">
          <EmptyState
            icon={Sparkles}
            title="No brief yet today"
            description="Generate one from your current tasks, habits, finances, health, and pipeline."
            action={<GenerateBriefButton action={generateDailyBriefAction} label="Generate today's brief" hasKey={hasGroqKey} />}
          />
        </div>
      )}

      <MentorChatWidget initialMessages={messages} hasKey={hasGroqKey} />
    </div>
  );
}
