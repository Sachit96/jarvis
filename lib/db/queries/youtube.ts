import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export async function getScripts(supabase: Client) {
  const { data, error } = await supabase.from("yt_scripts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getScript(supabase: Client, id: string) {
  const { data, error } = await supabase.from("yt_scripts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getThumbnails(supabase: Client, scriptId: string) {
  const { data, error } = await supabase.from("yt_thumbnails").select("*").eq("script_id", scriptId).order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}
