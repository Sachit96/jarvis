import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isMissingRelation } from "@/lib/db/missing-relation";

type Client = SupabaseClient<Database>;

export type GoogleCalendarConnection = Database["public"]["Tables"]["google_calendar_connections"]["Row"];

export async function getGoogleCalendarConnection(supabase: Client): Promise<GoogleCalendarConnection | null> {
  const { data, error } = await supabase.from("google_calendar_connections").select("*").eq("id", true).maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  return data;
}

export type GoogleCalendarEventLink = Database["public"]["Tables"]["google_calendar_event_links"]["Row"];
export type GoogleCalendarSourceType = GoogleCalendarEventLink["source_type"];

/** All existing local-row -> Google-event mappings, keyed "source_type:source_id" for O(1) lookup during sync. */
export async function getEventLinkMap(supabase: Client): Promise<Map<string, GoogleCalendarEventLink>> {
  const { data, error } = await supabase.from("google_calendar_event_links").select("*");
  if (error) {
    if (isMissingRelation(error)) return new Map();
    throw error;
  }
  return new Map(data.map((link) => [`${link.source_type}:${link.source_id}`, link]));
}
