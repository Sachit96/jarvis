import { createClient } from "@/lib/supabase/server";
import { getDailyRecommendation, getGeneralMentorMessages } from "@/lib/db/queries/mentor";
import { MentorConsole } from "@/components/mentor/mentor-console";
import { TIER_MODEL } from "@/lib/ai/providers/gemini-client";
import { todayStr } from "@/lib/date";

/**
 * The Mentor, as one console.
 *
 * Was a split screen: today's brief in a seven-column panel, the operator
 * chat squeezed into five beside it. Two problems with that. The brief was
 * long enough to own the page while being the thing you read once, and the
 * chat — the part that actually does work — was the narrow column. Asking a
 * follow-up about the brief meant looking at a 400px-wide reply next to the
 * 800px-wide thing it was about.
 *
 * Now the conversation is the page and the brief is a turn inside it, so a
 * follow-up sits directly under what it refers to. Nothing was thrown away:
 * generateDailyBrief still writes `daily_recommendations`, which is what the
 * weekly review and the scheduled job read.
 */
export default async function MentorPage() {
  const supabase = await createClient();
  const [brief, messages] = await Promise.all([
    getDailyRecommendation(supabase, todayStr()),
    getGeneralMentorMessages(supabase),
  ]);

  return (
    <MentorConsole
      initialMessages={messages}
      initialBrief={
        brief
          ? {
              recDate: brief.rec_date,
              markdownBody: brief.markdown_body,
              focusAreas: brief.focus_areas ?? [],
              strengths: brief.strengths ?? [],
              weaknesses: brief.weaknesses ?? [],
            }
          : null
      }
      // The key is read here, on the server, and only its presence crosses to
      // the client — never the value itself.
      hasKey={Boolean(process.env.GEMINI_API_KEY)}
      // The real model, not a label. A status line that names a model the app
      // does not run is worse than no status line.
      model={TIER_MODEL.structured}
    />
  );
}
