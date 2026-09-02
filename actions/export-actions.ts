"use server";

import { createClient } from "@/lib/supabase/server";
import { buildExportPayload } from "@/lib/export";

/**
 * The Settings page's "Export JSON backup" button calls this instead of
 * hitting /api/export/json directly — Server Actions get their own
 * same-origin check from Next.js, so the browser UI can trigger a real
 * export without CRON_SECRET ever being shipped to client code. The raw
 * GET route stays bearer-protected for external/scripted access.
 */
export async function exportJsonBackupAction(): Promise<{ ok: true; json: string } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const payload = await buildExportPayload(supabase);
    return { ok: true, json: JSON.stringify(payload, null, 2) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Export failed" };
  }
}
