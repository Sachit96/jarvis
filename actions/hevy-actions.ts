"use server";

import { createClient } from "@/lib/supabase/server";
import { syncHevyWorkouts } from "@/lib/providers/workout/hevy-sync";

/**
 * Both browser call sites (HevyAutoSync, HevySyncButton) call this
 * instead of fetching /api/hevy directly — Server Actions get their own
 * same-origin check from Next.js, so no secret needs to reach client
 * code. The raw POST /api/hevy route stays bearer-protected for
 * external/scripted access (e.g. a future cron-driven sync).
 */
export async function syncHevyAction(pageSize = 10): Promise<{ ok: boolean; message?: string; workoutsSynced?: number }> {
  const supabase = await createClient();
  try {
    return await syncHevyWorkouts(supabase, pageSize);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Hevy sync failed" };
  }
}
