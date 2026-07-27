import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export async function getDailyRecommendation(supabase: Client, date: string) {
  const { data, error } = await supabase
    .from("daily_recommendations")
    .select("*")
    .eq("rec_date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLatestWeeklyReview(supabase: Client) {
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .order("week_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const MENTOR_CHAT_HISTORY_LIMIT = 30;

export async function getGeneralMentorMessages(supabase: Client) {
  const { data, error } = await supabase
    .from("mentor_messages")
    .select("*")
    .eq("context", "mentor")
    .order("created_at", { ascending: false })
    .limit(MENTOR_CHAT_HISTORY_LIMIT);
  if (error) throw error;
  return data.reverse();
}
