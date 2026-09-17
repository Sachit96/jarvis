"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pushLocalScheduleToGoogle, type SyncResult } from "@/lib/google-calendar/sync";

export async function disconnectGoogleCalendarAction(): Promise<void> {
  const supabase = await createClient();
  // Event links point at a calendar that belongs to this connection —
  // clearing them too means reconnecting (a fresh calendar, per
  // findOrCreateJarvisCalendar) starts from a clean push rather than
  // trying to update event ids that lived on a now-disconnected account.
  await supabase.from("google_calendar_event_links").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("google_calendar_connections").delete().eq("id", true);
  revalidatePath("/settings");
}

export async function syncGoogleCalendarNowAction(): Promise<SyncResult> {
  const supabase = await createClient();
  const result = await pushLocalScheduleToGoogle(supabase);
  revalidatePath("/settings");
  return result;
}
