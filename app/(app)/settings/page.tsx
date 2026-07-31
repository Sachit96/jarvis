import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGhlConnection, getGhlSyncLogs } from "@/lib/db/queries/business";
import { AiMentorStatusCard } from "@/components/settings/ai-mentor-status-card";
import { GhlConnectionCard } from "@/components/settings/ghl-connection-card";
import { GhlSyncLogs } from "@/components/settings/ghl-sync-logs";
import { GEMINI_MODEL } from "@/lib/ai/providers/gemini-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  const [ghlConnection, ghlLogs] = await Promise.all([getGhlConnection(supabase), getGhlSyncLogs(supabase)]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">System</p>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <AiMentorStatusCard hasKey={hasGeminiKey} model={GEMINI_MODEL} />

      <GhlConnectionCard connection={ghlConnection} />
      <GhlSyncLogs logs={ghlLogs} />

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Data export</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Download every record you own across all modules as a single JSON file.
        </p>
        <a
          href="/api/export/json"
          download
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80"
        >
          <Download className="h-3.5 w-3.5" /> Export JSON backup
        </a>
      </div>
    </div>
  );
}
